CREATE TABLE IF NOT EXISTS `ribbons` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(500) NOT NULL,
  `ribbon_type` VARCHAR(100) NOT NULL DEFAULT 'Wax',
  `transfer_type` VARCHAR(100) NOT NULL DEFAULT 'Thermal Transfer',
  `width_mm` DECIMAL(10,2) NOT NULL DEFAULT 110.00,
  `length_m` DECIMAL(10,2) NOT NULL DEFAULT 300.00,
  `is_scratch_resistant` TINYINT(1) NOT NULL DEFAULT 0,
  `compatible_printers` LONGTEXT NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `min_stock` INT NOT NULL DEFAULT 5,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `supplier` VARCHAR(500) DEFAULT '',
  `notes` VARCHAR(2000) DEFAULT '',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ribbons_type` (`ribbon_type`),
  INDEX `idx_ribbons_stock` (`stock_quantity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ribbon_consumption` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ribbon_id` INT NOT NULL,
  `action_type` VARCHAR(100) NOT NULL DEFAULT 'consumption',
  `quantity` INT NOT NULL DEFAULT 1,
  `printer_name` VARCHAR(500) DEFAULT '',
  `production_line` VARCHAR(255) DEFAULT '',
  `department` VARCHAR(255) DEFAULT '',
  `operator_name` VARCHAR(255) DEFAULT '',
  `notes` VARCHAR(2000) DEFAULT '',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ribbon_consumption_ribbon` (`ribbon_id`),
  INDEX `idx_ribbon_consumption_action` (`action_type`),
  INDEX `idx_ribbon_consumption_created` (`created_at`),
  CONSTRAINT `fk_consumption_ribbon` FOREIGN KEY (`ribbon_id`) REFERENCES `ribbons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
