CREATE TYPE "public"."payment_status" AS ENUM('pendiente', 'confirmado', 'rechazado');--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"payment_id" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" "payment_status" DEFAULT 'confirmado' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;