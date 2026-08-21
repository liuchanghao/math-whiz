-- CreateTable
CREATE TABLE `grades` (
  `id` INTEGER NOT NULL,
  `name` VARCHAR(32) NOT NULL,
  `sort_order` INTEGER NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `grades_sort_order_key`(`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the only supported phase-one grades with stable identifiers.
INSERT INTO `grades` (`id`, `name`, `sort_order`, `status`, `updated_at`) VALUES
  (1, '小学一年级', 1, 'ACTIVE', CURRENT_TIMESTAMP(3)),
  (2, '小学二年级', 2, 'ACTIVE', CURRENT_TIMESTAMP(3)),
  (3, '小学三年级', 3, 'ACTIVE', CURRENT_TIMESTAMP(3)),
  (4, '小学四年级', 4, 'ACTIVE', CURRENT_TIMESTAMP(3)),
  (5, '小学五年级', 5, 'ACTIVE', CURRENT_TIMESTAMP(3)),
  (6, '小学六年级', 6, 'ACTIVE', CURRENT_TIMESTAMP(3));

-- CreateTable
CREATE TABLE `knowledge_points` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `knowledge_points_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_point_grades` (
  `knowledge_point_id` CHAR(36) NOT NULL,
  `grade_id` INTEGER NOT NULL,

  INDEX `knowledge_point_grades_grade_id_knowledge_point_id_idx`(`grade_id`, `knowledge_point_id`),
  PRIMARY KEY (`knowledge_point_id`, `grade_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `knowledge_point_grades`
  ADD CONSTRAINT `knowledge_point_grades_knowledge_point_id_fkey`
  FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_point_grades`
  ADD CONSTRAINT `knowledge_point_grades_grade_id_fkey`
  FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
