ALTER TABLE "payments" ALTER COLUMN "amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "needed_milli" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "billed_milli" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "total_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "total_cents" SET DATA TYPE bigint;