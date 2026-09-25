import { optionalText } from "./common";
import { z } from "./zod";

/** Photos must be ones we stored (customer uploads go through /api/reviews/photos). */
export const reviewPhotoUrl = z
  .string()
  .max(500)
  .refine(
    (v) =>
      /^\/uploads\/reviews\/[\w-]+\.webp$/.test(v) ||
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/.+\/reviews\/[\w-]+\.webp$/.test(v),
    "invalid",
  );

export const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z.int().min(1, "ratingRequired").max(5, "ratingRequired"),
  title: optionalText(100),
  body: optionalText(2000),
  imageUrls: z.array(reviewPhotoUrl).max(3, "tooManyPhotos"),
});
export type ReviewInput = z.input<typeof reviewSchema>;
