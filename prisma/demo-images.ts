/**
 * Demo catalogue photos from Unsplash (https://unsplash.com/license: free for commercial use).
 * Images are hot-linked from images.unsplash.com as Unsplash's API guidelines require; next/image
 * resizes them. Photographers are credited in docs/demo-photo-credits.md.
 * A real store replaces these by uploading its own photos in the admin panel.
 */
type Photo = { id: string; by: string };

const photo = (id: string, by: string): Photo => ({ id, by });

/** Unsplash image URL cropped to the given size (the source crop keeps next/image fast). */
export function unsplashUrl(p: Photo, width: number, height: number): string {
  return `https://images.unsplash.com/photo-${p.id}?auto=format&fit=crop&crop=entropy&w=${width}&h=${height}&q=80`;
}

export const productPhotos: Record<string, Photo[]> = {
  "classic-cotton-t-shirt": [
    photo("1521572163474-6864f9cf17ab", "Anomaly"),
    photo("1553754507-b3f37c9f11a6", "Hossein Hosseini"),
  ],
  "linen-kurta": [
    photo("1727835523545-70ee992b5763", "Firangi Yarn"),
    photo("1727835523550-18478cacefa2", "Firangi Yarn"),
  ],
  "kanchipuram-silk-saree": [
    photo("1641699862936-be9f49b1c38d", "Bella Pon Fruitsia"),
    photo("1727430228383-aa1fb59db8bf", "shades by 43"),
  ],
  "denim-jacket": [photo("1771744390734-ddc6a02b6d83", "yash solanki")],
  "filter-coffee-powder": [
    photo("1758387941825-a6ecaec9c14d", "Ayyappan Mk"),
    photo("1668236482744-b48b28650f12", "Deepal Tamang"),
  ],
  "mysore-pak": [
    photo("1667185487460-b303881b2bb9", "VD Photography"),
    photo("1667185487656-91aee4306658", "VD Photography"),
  ],
  "organic-turmeric-powder": [
    photo("1702041295331-840d4d9aa7c9", "Md Shakil Photography"),
    photo("1606914469633-bd39206ea739", "Tamanna Rumee"),
  ],
  "mango-pickle": [photo("1617854307432-13950e24ba07", "Prchi Palwe")],
  "wireless-earbuds": [
    photo("1630331384146-a8b2a79a9558", "Sayan Majhi"),
    photo("1598900863662-da1c3e6dd9d9", "Khoa Nguyen"),
  ],
  "bluetooth-speaker": [
    photo("1665672629999-0994c3f052a9", "Ian Talmacs"),
    photo("1588131153911-a4ea5189fe19", "Omar Flores"),
  ],
  "power-bank-10000mah": [
    photo("1644571669401-9ab344866592", "Kamil Switalski"),
    photo("1566554738544-d962991c3fee", "I'M ZION"),
  ],
  "smart-watch": [
    photo("1627040849263-b94ab1502618", "Giang duong"),
    photo("1641457474717-26e699f45414", "Aviv Rachmadian"),
  ],
};

export const categoryPhotos = {
  clothing: photo("1717585679395-bbe39b5fb6bc", "Jainica Dhingra"),
  food: photo("1716816211590-c15a328a5ff0", "Anju Ravindranath"),
  electronics: photo("1615655406736-b37c4fabf923", "Onur Binay"),
} satisfies Record<string, Photo>;

export const bannerPhotos = {
  festive: photo("1503160865267-af4660ce7bf2", "Naganath Chiluveru"),
  tech: photo("1615655406736-b37c4fabf923", "Onur Binay"),
  coffee: photo("1668236482744-b48b28650f12", "Deepal Tamang"),
} satisfies Record<string, Photo>;

export function productImageUrl(slug: string, index: number): string | null {
  const p = productPhotos[slug]?.[index];
  return p ? unsplashUrl(p, 1200, 1200) : null;
}

export function productImageCount(slug: string): number {
  return productPhotos[slug]?.length ?? 0;
}
