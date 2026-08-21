-- CreateTable
CREATE TABLE `members` (
  `id` CHAR(36) NOT NULL,
  `phone` CHAR(11) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `failed_login_count` INTEGER NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `members_phone_key`(`phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_sessions` (
  `id` CHAR(36) NOT NULL,
  `member_id` CHAR(36) NOT NULL,
  `active_member_id` CHAR(36) NULL,
  `access_token_hash` CHAR(64) NOT NULL,
  `access_expires_at` DATETIME(3) NOT NULL,
  `refresh_token_hash` CHAR(64) NOT NULL,
  `refresh_expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `rotated_from_session_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `member_sessions_active_member_id_key`(`active_member_id`),
  UNIQUE INDEX `member_sessions_access_token_hash_key`(`access_token_hash`),
  UNIQUE INDEX `member_sessions_refresh_token_hash_key`(`refresh_token_hash`),
  UNIQUE INDEX `member_sessions_rotated_from_session_id_key`(`rotated_from_session_id`),
  INDEX `member_sessions_member_id_revoked_at_refresh_expires_at_idx`(`member_id`, `revoked_at`, `refresh_expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `member_sessions`
  ADD CONSTRAINT `member_sessions_member_id_fkey`
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_sessions`
  ADD CONSTRAINT `member_sessions_active_member_id_fkey`
  FOREIGN KEY (`active_member_id`) REFERENCES `members`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_sessions`
  ADD CONSTRAINT `member_sessions_rotated_from_session_id_fkey`
  FOREIGN KEY (`rotated_from_session_id`) REFERENCES `member_sessions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
