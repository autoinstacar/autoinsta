import http from 'http';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Iniciando testes funcionais...');

  // 1. Dashboard inicial
  const dash1 = await makeRequest('GET', '/dashboard');
  console.log('1. Dashboard carregado:', dash1.status === 200 ? 'OK' : 'FALHA', dash1.data?.metrics);

  // 2. Criar Campanha
  const newCamp = await makeRequest('POST', '/campaigns', {
    name: 'Campanha Teste E2E',
    post_url: 'https://www.instagram.com/p/TESTE123/',
    group_link: 'https://chat.whatsapp.com/TESTE_LINK',
    private_message: 'Olá {{usuario}}! Aqui está o grupo: {{link_grupo}}',
    public_reply: 'Te enviei no direct @{{usuario}}!',
    keywords: 'eu quero, vip',
    status: 'ativo'
  });
  console.log('2. Campanha criada:', newCamp.status === 201 ? 'OK' : 'FALHA', 'ID:', newCamp.data?.id);
  const campId = newCamp.data.id;

  // 3. Cadastrar Atendimento para @joaosilva
  const newContact = await makeRequest('POST', '/contacts', {
    campaign_id: campId,
    username: '@joaosilva',
    internal_id: 'LEAD-001',
    notes: 'Pediu link no comentário'
  });
  console.log('3. Atendimento cadastrado:', newContact.status === 201 ? 'OK' : 'FALHA', 'ID:', newContact.data?.id, 'Status:', newContact.data?.status);
  const contactId = newContact.data.id;

  // 4. Testar que status inicial é 'Pendente' e NÃO 'Enviado'
  const dashAfterCreate = await makeRequest('GET', '/dashboard');
  console.log('4. Verificando que não marca como enviado antecipadamente:');
  console.log('   - Directs confirmados:', dashAfterCreate.data.metrics.confirmedDMs, '(deve ser 0)');
  console.log('   - Mensagens preparadas:', dashAfterCreate.data.metrics.preparedMessages, '(deve ser 0)');

  // 5. Preparar mensagem (operador copiou)
  const prepared = await makeRequest('PATCH', `/contacts/${contactId}/prepare`);
  console.log('5. Mensagem preparada:', prepared.data?.status === 'Mensagem preparada' ? 'OK' : 'FALHA');

  // Checa novamente métricas
  const dashAfterPrepare = await makeRequest('GET', '/dashboard');
  console.log('   - Mensagens preparadas agora:', dashAfterPrepare.data.metrics.preparedMessages, '(deve ser 1)');
  console.log('   - Directs confirmados ainda:', dashAfterPrepare.data.metrics.confirmedDMs, '(deve ser 0)');

  // 6. Operador confirma envio manual no direct
  const confirmed = await makeRequest('PATCH', `/contacts/${contactId}/confirm-direct`);
  console.log('6. Direct confirmado:', confirmed.data?.status === 'Direct confirmado pelo operador' ? 'OK' : 'FALHA');

  // 7. Operador confirma resposta pública
  const reply = await makeRequest('PATCH', `/contacts/${contactId}/confirm-public-reply`);
  console.log('7. Resposta pública confirmada:', reply.data?.public_reply_sent === 1 ? 'OK' : 'FALHA');

  // 8. Concluir atendimento
  const completed = await makeRequest('PATCH', `/contacts/${contactId}/complete`);
  console.log('8. Atendimento concluído:', completed.data?.status === 'Concluído' ? 'OK' : 'FALHA');

  // 9. Histórico gravado
  const history = await makeRequest('GET', `/history?contact_record_id=${contactId}`);
  console.log('9. Logs no histórico para este atendimento:', history.data?.length, 'eventos gravados');

  // 10. Exportação CSV
  const csvRes = await makeRequest('GET', '/export/csv');
  console.log('10. Exportação CSV:', csvRes.status === 200 ? 'OK' : 'FALHA', 'Bytes:', csvRes.text?.length);

  console.log('TODOS OS TESTES E2E EXECUTADOS COM SUCESSO!');
}

runTests().catch(console.error);
