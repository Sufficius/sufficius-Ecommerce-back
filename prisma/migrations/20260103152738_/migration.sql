-- CreateTable
CREATE TABLE `avaliacao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `nota` INTEGER NOT NULL DEFAULT 5,
    `comentario` VARCHAR(191) NULL,
    `compraVerificada` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `avaliacao_produtoId_idx`(`produtoId`),
    INDEX `avaliacao_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `avaliacao_usuarioId_produtoId_key`(`usuarioId`, `produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carrinho` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `carrinho_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categoria` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `paiId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `categoria_nome_key`(`nome`),
    UNIQUE INDEX `categoria_slug_key`(`slug`),
    INDEX `categoria_paiId_idx`(`paiId`),
    INDEX `categoria_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devolucao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `itemPedidoId` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `solicitadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aprovadoEm` DATETIME(3) NULL,
    `concluidoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `devolucao_itemPedidoId_idx`(`itemPedidoId`),
    INDEX `devolucao_pedidoId_idx`(`pedidoId`),
    INDEX `devolucao_status_idx`(`status`),
    INDEX `devolucao_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `endereco` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `rua` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `complemento` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NOT NULL,
    `cidade` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `cep` VARCHAR(191) NOT NULL,
    `pais` VARCHAR(191) NOT NULL DEFAULT 'Brasil',
    `padrao` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `endereco_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historicostatuspedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PAGAMENTO_PENDENTE', 'PROCESSANDO', 'CONFIRMADO', 'PREPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO', 'DEVOLVIDO', 'REEMBOLSADO') NOT NULL,
    `observacoes` VARCHAR(191) NULL,
    `alteradoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `alteradoPor` VARCHAR(191) NULL,

    INDEX `historicostatuspedido_alteradoEm_idx`(`alteradoEm`),
    INDEX `historicostatuspedido_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imagemproduto` (
    `id` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `textoAlt` VARCHAR(191) NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `imagemproduto_produtoId_idx`(`produtoId`),
    UNIQUE INDEX `imagemproduto_produtoId_principal_key`(`produtoId`, `principal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itemcarrinho` (
    `id` VARCHAR(191) NOT NULL,
    `carrinhoId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 1,
    `precoNoCarrinho` DOUBLE NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itemcarrinho_carrinhoId_idx`(`carrinhoId`),
    INDEX `itemcarrinho_produtoId_idx`(`produtoId`),
    UNIQUE INDEX `itemcarrinho_carrinhoId_produtoId_key`(`carrinhoId`, `produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itempedido` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `precoUnitario` DOUBLE NOT NULL,
    `precoTotal` DOUBLE NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itempedido_pedidoId_idx`(`pedidoId`),
    INDEX `itempedido_produtoId_idx`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagamento` (
    `id` VARCHAR(191) NOT NULL,
    `pedidoId` VARCHAR(191) NOT NULL,
    `metodoPagamento` VARCHAR(191) NOT NULL,
    `gatewayPagamento` VARCHAR(191) NOT NULL,
    `gatewayId` VARCHAR(191) NULL,
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU', 'REEMBOLSADO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `valor` DOUBLE NOT NULL,
    `ultimosQuatro` VARCHAR(191) NULL,
    `bandeira` VARCHAR(191) NULL,
    `metadata` VARCHAR(191) NULL,
    `processadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pagamento_gatewayId_idx`(`gatewayId`),
    INDEX `pagamento_pedidoId_idx`(`pedidoId`),
    INDEX `pagamento_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido` (
    `id` VARCHAR(191) NOT NULL,
    `numeroPedido` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `enderecoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PAGAMENTO_PENDENTE', 'PROCESSANDO', 'CONFIRMADO', 'PREPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO', 'DEVOLVIDO', 'REEMBOLSADO') NOT NULL DEFAULT 'PAGAMENTO_PENDENTE',
    `subtotal` DOUBLE NOT NULL,
    `frete` DOUBLE NOT NULL,
    `imposto` DOUBLE NOT NULL,
    `desconto` DOUBLE NOT NULL DEFAULT 0.00,
    `total` DOUBLE NOT NULL,
    `codigoRastreio` VARCHAR(191) NULL,
    `metodoEnvio` VARCHAR(191) NOT NULL,
    `entregaEstimada` DATETIME(3) NULL,
    `entregueEm` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cupomId` VARCHAR(191) NULL,

    UNIQUE INDEX `pedido_numeroPedido_key`(`numeroPedido`),
    INDEX `pedido_criadoEm_idx`(`criadoEm`),
    INDEX `pedido_enderecoId_idx`(`enderecoId`),
    INDEX `pedido_numeroPedido_idx`(`numeroPedido`),
    INDEX `pedido_status_idx`(`status`),
    INDEX `pedido_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produto` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `preco` DOUBLE NOT NULL,
    `precoDesconto` DOUBLE NULL,
    `percentualDesconto` DOUBLE NULL DEFAULT 0,
    `descontoAte` DATETIME(3) NULL,
    `estoque` INTEGER NOT NULL DEFAULT 0,
    `sku` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `emDestaque` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `produto_sku_key`(`sku`),
    INDEX `produto_ativo_idx`(`ativo`),
    INDEX `produto_estoque_idx`(`estoque`),
    INDEX `produto_nome_idx`(`nome`),
    INDEX `produto_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokenverificacao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tokenverificacao_token_key`(`token`),
    INDEX `tokenverificacao_token_idx`(`token`),
    INDEX `tokenverificacao_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `emailVerificado` BOOLEAN NOT NULL DEFAULT false,
    `telefoneVerificado` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDENTE', 'ATIVO', 'SUSPENSO', 'DELETADO') NOT NULL DEFAULT 'PENDENTE',
    `tipo` ENUM('CLIENTE', 'ADMIN', 'GERENTE') NOT NULL DEFAULT 'CLIENTE',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoLogin` DATETIME(3) NULL,
    `googleId` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `resetToken` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,

    UNIQUE INDEX `usuario_email_key`(`email`),
    UNIQUE INDEX `usuario_telefone_key`(`telefone`),
    INDEX `usuario_email_idx`(`email`),
    INDEX `usuario_telefone_idx`(`telefone`),
    UNIQUE INDEX `usuario_email_telefone_key`(`email`, `telefone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupom` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `tipo` ENUM('PERCENTUAL', 'VALOR_FIXO') NOT NULL DEFAULT 'PERCENTUAL',
    `valor` DOUBLE NOT NULL,
    `validoAte` DATETIME(3) NOT NULL,
    `usado` INTEGER NOT NULL DEFAULT 0,
    `maxUsage` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cupom_codigo_key`(`codigo`),
    INDEX `cupom_codigo_idx`(`codigo`),
    INDEX `cupom_ativo_idx`(`ativo`),
    INDEX `cupom_validoAte_idx`(`validoAte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_produtocategorias` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_produtocategorias_AB_unique`(`A`, `B`),
    INDEX `_produtocategorias_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `avaliacao` ADD CONSTRAINT `avaliacao_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacao` ADD CONSTRAINT `avaliacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carrinho` ADD CONSTRAINT `carrinho_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categoria` ADD CONSTRAINT `categoria_paiId_fkey` FOREIGN KEY (`paiId`) REFERENCES `categoria`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devolucao` ADD CONSTRAINT `devolucao_itemPedidoId_fkey` FOREIGN KEY (`itemPedidoId`) REFERENCES `itempedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devolucao` ADD CONSTRAINT `devolucao_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devolucao` ADD CONSTRAINT `devolucao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `endereco` ADD CONSTRAINT `endereco_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historicostatuspedido` ADD CONSTRAINT `historicostatuspedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `imagemproduto` ADD CONSTRAINT `imagemproduto_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itemcarrinho` ADD CONSTRAINT `itemcarrinho_carrinhoId_fkey` FOREIGN KEY (`carrinhoId`) REFERENCES `carrinho`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itemcarrinho` ADD CONSTRAINT `itemcarrinho_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itempedido` ADD CONSTRAINT `itempedido_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itempedido` ADD CONSTRAINT `itempedido_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamento` ADD CONSTRAINT `pagamento_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_enderecoId_fkey` FOREIGN KEY (`enderecoId`) REFERENCES `endereco`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_cupomId_fkey` FOREIGN KEY (`cupomId`) REFERENCES `cupom`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokenverificacao` ADD CONSTRAINT `tokenverificacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_produtocategorias` ADD CONSTRAINT `_produtocategorias_A_fkey` FOREIGN KEY (`A`) REFERENCES `categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_produtocategorias` ADD CONSTRAINT `_produtocategorias_B_fkey` FOREIGN KEY (`B`) REFERENCES `produto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
