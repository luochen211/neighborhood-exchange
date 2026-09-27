import { ITEM_IMAGES, type ImageKey } from "@neighborhood/contracts";
export const itemImages = Object.fromEntries(ITEM_IMAGES.map(image => [image.key, { label: image.name, src: `/demo-items/${image.file}`, caption: "AI 生成演示图片" }])) as Record<ImageKey, { label: string; src: string; caption: string }>;
