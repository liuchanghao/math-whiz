-- CreateTable
CREATE TABLE `prizes` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `description` TEXT NOT NULL,
  `claim_instructions` TEXT NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `prizes_status_created_at_idx`(`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prize_grades` (
  `prize_id` CHAR(36) NOT NULL,
  `grade_id` INTEGER NOT NULL,

  INDEX `prize_grades_grade_id_prize_id_idx`(`grade_id`, `prize_id`),
  PRIMARY KEY (`prize_id`, `grade_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `grades` ADD COLUMN `current_prize_id` CHAR(36) NULL;
CREATE INDEX `grades_current_prize_id_idx` ON `grades`(`current_prize_id`);

-- CreateTable
CREATE TABLE `questions` (
  `id` CHAR(36) NOT NULL,
  `type` ENUM('SINGLE_CHOICE', 'TRUE_FALSE', 'NUMERIC_FILL', 'EXPRESSION', 'VERTICAL_CALCULATION') NOT NULL,
  `stem` TEXT NOT NULL,
  `explanation` TEXT NULL,
  `difficulty` ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
  `grading_config` JSON NOT NULL,
  `is_used` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `questions_status_difficulty_created_at_idx`(`status`, `difficulty`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_options` (
  `id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `text` TEXT NOT NULL,
  `sort_order` INTEGER NOT NULL,
  `is_correct` BOOLEAN NOT NULL DEFAULT false,

  UNIQUE INDEX `question_options_question_id_sort_order_key`(`question_id`, `sort_order`),
  INDEX `question_options_question_id_is_correct_idx`(`question_id`, `is_correct`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_grades` (
  `question_id` CHAR(36) NOT NULL,
  `grade_id` INTEGER NOT NULL,

  INDEX `question_grades_grade_id_question_id_idx`(`grade_id`, `question_id`),
  PRIMARY KEY (`question_id`, `grade_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_knowledge_points` (
  `question_id` CHAR(36) NOT NULL,
  `knowledge_point_id` CHAR(36) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,

  INDEX `question_knowledge_points_knowledge_point_id_question_id_idx`(`knowledge_point_id`, `question_id`),
  INDEX `question_knowledge_points_question_id_is_primary_idx`(`question_id`, `is_primary`),
  PRIMARY KEY (`question_id`, `knowledge_point_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prize_grades`
  ADD CONSTRAINT `prize_grades_prize_id_fkey`
  FOREIGN KEY (`prize_id`) REFERENCES `prizes`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `prize_grades`
  ADD CONSTRAINT `prize_grades_grade_id_fkey`
  FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `grades`
  ADD CONSTRAINT `grades_current_prize_id_fkey`
  FOREIGN KEY (`current_prize_id`) REFERENCES `prizes`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `question_options`
  ADD CONSTRAINT `question_options_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `question_grades`
  ADD CONSTRAINT `question_grades_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `question_grades`
  ADD CONSTRAINT `question_grades_grade_id_fkey`
  FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `question_knowledge_points`
  ADD CONSTRAINT `question_knowledge_points_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `question_knowledge_points`
  ADD CONSTRAINT `question_knowledge_points_knowledge_point_id_fkey`
  FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
