-- CreateTable
CREATE TABLE `admins` (
  `id` CHAR(36) NOT NULL,
  `singleton_key` INTEGER NOT NULL DEFAULT 1,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `failed_login_count` INTEGER NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `admins_singleton_key_key`(`singleton_key`),
  UNIQUE INDEX `admins_username_key`(`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_sessions` (
  `id` CHAR(36) NOT NULL,
  `admin_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `csrf_token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `admin_sessions_token_hash_key`(`token_hash`),
  INDEX `admin_sessions_admin_id_revoked_at_expires_at_idx`(`admin_id`, `revoked_at`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_login_throttles` (
  `fingerprint_hash` CHAR(64) NOT NULL,
  `window_started_at` DATETIME(3) NOT NULL,
  `attempt_count` INTEGER NOT NULL DEFAULT 0,
  `blocked_until` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`fingerprint_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `admin_id` CHAR(36) NULL,
  `action` VARCHAR(64) NOT NULL,
  `target_type` VARCHAR(64) NOT NULL,
  `target_id` VARCHAR(128) NULL,
  `summary` JSON NOT NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `audit_logs_admin_id_created_at_idx`(`admin_id`, `created_at`),
  INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `admin_sessions_admin_id_fkey`
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_admin_id_fkey`
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit records are append-only even for direct database clients.
CREATE TRIGGER `audit_logs_prevent_update`
BEFORE UPDATE ON `audit_logs`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit logs are append-only';

CREATE TRIGGER `audit_logs_prevent_delete`
BEFORE DELETE ON `audit_logs`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit logs are append-only';
