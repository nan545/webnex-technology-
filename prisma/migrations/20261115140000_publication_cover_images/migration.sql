ALTER TABLE "Project" ADD COLUMN "coverImageId" UUID;
ALTER TABLE "BlogPost" ADD COLUMN "coverImageId" UUID;

CREATE INDEX "Project_coverImageId_idx" ON "Project"("coverImageId");
CREATE INDEX "BlogPost_coverImageId_idx" ON "BlogPost"("coverImageId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_coverImageId_fkey"
  FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_coverImageId_fkey"
  FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
