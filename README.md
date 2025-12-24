# sufficius-Ecommerce-back

## Fluxo de Funcionamento

### 1. Cadastro e Autenticação
- Para se tornar um comprador, o usuário deve estar cadastrado.
- Para estar cadastrado deve informar: nome, senha, número de telefone, email.
- O cadastro é finalizado quando o email e o número de telefone forem verificados.
- Dados sensíveis do usuário devem ser armazenados de forma segura.

### 2. Visualização de Produtos
- Todo usuário pode visualizar os produtos sendo cadastrado ou não.
- Um produto possui tipo, preço e imagens.
- Um produto pode ter desconto aplicado temporariamente.

### 3. Carrinho de Compras
- Um pedido de compra deve conter o produto e a quantidade desejada.
- A quantidade desejada não pode exceder a existente no estoque.
- Um carrinho pode conter mais de um pedido de compra.
- O estoque de um produto deve ser validado antes de confirmar a compra.
- Produtos com estoque nulo não apareceram

### 4. Pagamento e Finalização
- Pagamento deve ser realizado antes da finalização do pedido.
- Um carrinho só é finalizado quando a compra é efetivada e comprovada.

### 5. Acompanhamento e Entrega
- Uma compra só é dada como finalizada quando entregue ao comprador.
- Um usuário pode acompanhar o status do seu pedido em tempo real.
- Devoluções são permitidas dentro de 30 dias após a entrega. // regra aberta a alterações

### 6. Administração
- Um administrador pode gerenciar produtos, usuários e pedidos.
