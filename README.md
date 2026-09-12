# GranaZap

MVP de finanças pessoais para GitHub Pages, com arquitetura preparada para Firebase e WhatsApp Cloud API.

## Funcionalidades desta versão
- Dashboard de saldo, entradas, saídas e quantidade de lançamentos.
- Cadastro e exclusão de lançamentos.
- Busca de lançamentos.
- Classificação automática por regras aprendidas.
- Regra inicial: RJOTA COMERCIO E SERVICOS / CNPJ 48.379.018/0001-72 => Comércio.
- Layout responsivo para celular.
- Estrutura inicial de Firebase Function para webhook do WhatsApp Cloud API.

## Publicar o front-end no GitHub Pages
1. Crie um repositório no GitHub, por exemplo `granazap`.
2. Envie `index.html`, `styles.css` e `app.js` para a raiz do repositório.
3. Abra Settings > Pages.
4. Em Build and deployment, escolha `Deploy from a branch`.
5. Selecione a branch `main` e a pasta `/ (root)`.
6. Salve. O GitHub fornecerá o endereço público.

## Firebase / WhatsApp
Não coloque token do WhatsApp, chave privada ou segredo dentro de `app.js`.
O webhook deve rodar no Firebase Functions. Configure os segredos no ambiente do Firebase e cadastre a URL da Function no painel Meta for Developers.

## Próxima etapa
- Firebase Authentication
- Firestore em tempo real
- upload de comprovantes
- extração automática de dados de PDF/imagem
- webhook completo do WhatsApp Cloud API
- categorização por IA + regras aprendidas
