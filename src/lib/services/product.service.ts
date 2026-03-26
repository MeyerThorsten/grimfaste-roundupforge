import { prisma } from '@/lib/prisma';
import { ExtractedProduct } from '@/types';

export async function insertProduct(keywordResultId: number, product: ExtractedProduct) {
  return prisma.product.create({
    data: {
      keywordResultId,
      title: product.title,
      asin: product.asin,
      productUrl: product.productUrl,
      affiliateUrl: product.affiliateUrl,
      imageUrl: product.imageUrl,
      featureBullets: product.featureBullets,
      productDescription: product.productDescription,
      productFacts: product.productFacts,
      techDetails: product.techDetails,
      reviews: product.reviews,
      mergedText: product.mergedText,
      scrapeDebug: JSON.stringify(product.scrapeDebug),
      position: product.position,
    },
  });
}

export async function deleteProductsByKeyword(keywordResultId: number) {
  await prisma.product.deleteMany({ where: { keywordResultId } });
}

export async function countProductsByKeyword(keywordResultId: number): Promise<number> {
  return prisma.product.count({ where: { keywordResultId } });
}

export async function toggleProductExclusion(productId: number, excluded: boolean) {
  return prisma.product.update({
    where: { id: productId },
    data: { excluded },
  });
}
