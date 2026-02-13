-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `fotoUrl` VARCHAR(191) NULL,
    `dataNascimento` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` ENUM('CLIENTE', 'ADMIN') NOT NULL DEFAULT 'CLIENTE',
    `atualizadoEm` DATETIME(3) NOT NULL,
    `status` ENUM('ATIVO', 'INATIVO', 'SUSPENSO') NOT NULL DEFAULT 'ATIVO',
    `emailVerificado` BOOLEAN NOT NULL DEFAULT false,
    `googleId` VARCHAR(191) NULL,
    `ultimoLogin` DATETIME(3) NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    UNIQUE INDEX `Usuario_telefone_key`(`telefone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Endereco` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `rua` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `bairro` VARCHAR(191) NOT NULL,
    `cidade` VARCHAR(191) NOT NULL,
    `provincia` VARCHAR(191) NOT NULL DEFAULT 'Luanda',
    `padrao` BOOLEAN NOT NULL DEFAULT false,
    `telefone` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Produto` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `preco` DOUBLE NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `id_categoria` VARCHAR(191) NOT NULL,
    `status` ENUM('ATIVO', 'INATIVO', 'ESGOTADO') NOT NULL DEFAULT 'ATIVO',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Categoria` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Categoria_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImagemProduto` (
    `id` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `principal` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ImagemProduto_produtoId_idx`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Carrinho` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Carrinho_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemCarrinho` (
    `id` VARCHAR(191) NOT NULL,
    `carrinhoId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 1,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ItemCarrinho_carrinhoId_idx`(`carrinhoId`),
    UNIQUE INDEX `ItemCarrinho_carrinhoId_produtoId_key`(`carrinhoId`, `produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pedido` (
    `id` VARCHAR(191) NOT NULL,
    `numeroPedido` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `enderecoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PAGAMENTO_PENDENTE', 'PROCESSANDO', 'CONFIRMADO', 'ENVIADO', 'ENTREGUE', 'CANCELADO') NOT NULL DEFAULT 'PAGAMENTO_PENDENTE',
    `subtotal` DOUBLE NOT NULL,
    `frete` DOUBLE NOT NULL,
    `desconto` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL,
    `metodoEnvio` VARCHAR(191) NOT NULL,
    `codigoRastreio` VARCHAR(191) NULL,
    `dataEntrega` DATETIME(3) NULL,
    `entregueEm` DATETIME(3) NULL,
    `metodoPagamento` ENUM('MPESA', 'UNITEL_MONEY', 'TRANSFERENCIA_BANCARIA', 'CARTAO_CREDITO', 'DINHEIRO_ENTREGA') NOT NULL,
    `statusPagamento` ENUM('PENDENTE', 'PROCESSANDO', 'APROVADO', 'FALHOU', 'REEMBOLSADO', 'EXPIRADO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `referenciaPagamento` VARCHAR(191) NULL,
    `dataPagamento` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pedido_numeroPedido_key`(`numeroPedido`),
    INDEX `Pedido_usuarioId_idx`(`usuarioId`),
    INDEX `Pedido_status_idx`(`status`),
    INDEX `Pedido_criadoEm_idx`(`criadoEm`),
    INDEX `Pedido_statusPagamento_idx`(`statusPagamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemPedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `precoUnitario` DOUBLE NOT NULL,
    `precoTotal` DOUBLE NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ItemPedido_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricoPedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PAGAMENTO_PENDENTE', 'PROCESSANDO', 'CONFIRMADO', 'ENVIADO', 'ENTREGUE', 'CANCELADO') NOT NULL,
    `observacao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HistoricoPedido_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Avaliacao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `nota` INTEGER NOT NULL,
    `comentario` VARCHAR(191) NULL,
    `verificada` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Avaliacao_produtoId_idx`(`produtoId`),
    INDEX `Avaliacao_nota_idx`(`nota`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pagamento` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `metodo` ENUM('MPESA', 'UNITEL_MONEY', 'TRANSFERENCIA_BANCARIA', 'CARTAO_CREDITO', 'DINHEIRO_ENTREGA') NOT NULL,
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'APROVADO', 'FALHOU', 'REEMBOLSADO', 'EXPIRADO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `tipo` ENUM('PAGAMENTO_PEDIDO', 'RECARGA_SALDO', 'DEPOSITO') NOT NULL DEFAULT 'PAGAMENTO_PEDIDO',
    `valor` DOUBLE NOT NULL,
    `mpesaPhoneNumber` VARCHAR(191) NULL,
    `mpesaTransactionId` VARCHAR(191) NULL,
    `unitelMoneyPhone` VARCHAR(191) NULL,
    `contaBancaria` VARCHAR(191) NULL,
    `referenciaBancaria` VARCHAR(191) NULL,
    `cartaoLast4` VARCHAR(191) NULL,
    `cartaoBandeira` VARCHAR(191) NULL,
    `gatewayId` VARCHAR(191) NULL,
    `gatewayResponse` VARCHAR(191) NULL,
    `gatewayCode` VARCHAR(191) NULL,
    `confirmadoPor` VARCHAR(191) NULL,
    `confirmadoEm` DATETIME(3) NULL,
    `canceladoPor` VARCHAR(191) NULL,
    `canceladoEm` DATETIME(3) NULL,
    `motivoCancelamento` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `dataExpiracao` DATETIME(3) NULL,
    `tentativas` INTEGER NOT NULL DEFAULT 0,

    INDEX `Pagamento_pedidoId_idx`(`pedidoId`),
    INDEX `Pagamento_usuarioId_idx`(`usuarioId`),
    INDEX `Pagamento_status_idx`(`status`),
    INDEX `Pagamento_criadoEm_idx`(`criadoEm`),
    INDEX `Pagamento_gatewayId_idx`(`gatewayId`),
    UNIQUE INDEX `Pagamento_gatewayId_key`(`gatewayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricoPagamento` (
    `id` VARCHAR(191) NOT NULL,
    `pagamentoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'APROVADO', 'FALHOU', 'REEMBOLSADO', 'EXPIRADO', 'CANCELADO') NOT NULL,
    `observacao` VARCHAR(191) NULL,
    `gatewayData` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HistoricoPagamento_pagamentoId_idx`(`pagamentoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConfiguracaoPagamento` (
    `id` VARCHAR(191) NOT NULL,
    `metodo` ENUM('MPESA', 'UNITEL_MONEY', 'TRANSFERENCIA_BANCARIA', 'CARTAO_CREDITO', 'DINHEIRO_ENTREGA') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `nomeExibicao` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `taxaPercentual` DOUBLE NOT NULL DEFAULT 0,
    `taxaFixa` DOUBLE NOT NULL DEFAULT 0,
    `instrucoes` VARCHAR(191) NULL,
    `limiteMinimo` DOUBLE NULL,
    `limiteMaximo` DOUBLE NULL,
    `chavePublicaGateway` VARCHAR(191) NULL,
    `modoTeste` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConfiguracaoPagamento_metodo_key`(`metodo`),
    INDEX `ConfiguracaoPagamento_metodo_idx`(`metodo`),
    INDEX `ConfiguracaoPagamento_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reembolso` (
    `id` VARCHAR(191) NOT NULL,
    `pagamentoId` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `valor` DOUBLE NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDENTE', 'APROVADO', 'PROCESSANDO', 'CONCLUIDO', 'RECUSADO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `metodoReembolso` ENUM('MESMA_VIA', 'TRANSFERENCIA', 'CREDITO_LOJA', 'OUTRO') NOT NULL,
    `transacaoId` VARCHAR(191) NULL,
    `solicitadoPor` VARCHAR(191) NOT NULL,
    `aprovadoPor` VARCHAR(191) NULL,
    `aprovadoEm` DATETIME(3) NULL,
    `processadoEm` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `Reembolso_pagamentoId_idx`(`pagamentoId`),
    INDEX `Reembolso_pedidoId_idx`(`pedidoId`),
    INDEX `Reembolso_usuarioId_idx`(`usuarioId`),
    INDEX `Reembolso_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Endereco` ADD CONSTRAINT `Endereco_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Produto` ADD CONSTRAINT `Produto_id_categoria_fkey` FOREIGN KEY (`id_categoria`) REFERENCES `Categoria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImagemProduto` ADD CONSTRAINT `ImagemProduto_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `Produto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Carrinho` ADD CONSTRAINT `Carrinho_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCarrinho` ADD CONSTRAINT `ItemCarrinho_carrinhoId_fkey` FOREIGN KEY (`carrinhoId`) REFERENCES `Carrinho`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCarrinho` ADD CONSTRAINT `ItemCarrinho_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `Produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pedido` ADD CONSTRAINT `Pedido_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pedido` ADD CONSTRAINT `Pedido_enderecoId_fkey` FOREIGN KEY (`enderecoId`) REFERENCES `Endereco`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPedido` ADD CONSTRAINT `ItemPedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPedido` ADD CONSTRAINT `ItemPedido_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `Produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricoPedido` ADD CONSTRAINT `HistoricoPedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avaliacao` ADD CONSTRAINT `Avaliacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avaliacao` ADD CONSTRAINT `Avaliacao_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `Produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avaliacao` ADD CONSTRAINT `Avaliacao_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pagamento` ADD CONSTRAINT `Pagamento_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pagamento` ADD CONSTRAINT `Pagamento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricoPagamento` ADD CONSTRAINT `HistoricoPagamento_pagamentoId_fkey` FOREIGN KEY (`pagamentoId`) REFERENCES `Pagamento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reembolso` ADD CONSTRAINT `Reembolso_pagamentoId_fkey` FOREIGN KEY (`pagamentoId`) REFERENCES `Pagamento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reembolso` ADD CONSTRAINT `Reembolso_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `Pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reembolso` ADD CONSTRAINT `Reembolso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
