CREATE TABLE "StoredMediaObject" (
    "storageKey" VARCHAR(500) NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredMediaObject_pkey" PRIMARY KEY ("storageKey"),
    CONSTRAINT "StoredMediaObject_data_size_check" CHECK (octet_length("data") BETWEEN 1 AND 5242880)
);
