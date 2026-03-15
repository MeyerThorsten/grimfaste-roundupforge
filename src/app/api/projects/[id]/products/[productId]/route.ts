import { NextResponse } from 'next/server';
import { toggleProductExclusion } from '@/lib/services/product.service';

type Params = { params: Promise<{ id: string; productId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { productId } = await params;
  const body = await request.json();

  if (typeof body.excluded !== 'boolean') {
    return NextResponse.json({ error: 'excluded must be a boolean' }, { status: 400 });
  }

  try {
    const product = await toggleProductExclusion(Number(productId), body.excluded);
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
}
