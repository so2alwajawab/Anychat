import { NextResponse, type NextRequest } from "next/server";

// Global cache for post customizations (customer name, attached image preview)
const postMetadataStore = new Map<
  string,
  {
    postId: string;
    customerName?: string;
    imageUrl?: string;
    updatedAt: string;
  }
>();

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let postId = "default";
    let customerName = "";
    let imageUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      postId = (formData.get("postId") as string) || "default";
      customerName = (formData.get("customerName") as string) || "";
      const file = formData.get("image") as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
      } else {
        imageUrl = (formData.get("imageUrl") as string) || "";
      }
    } else {
      const body = await req.json();
      postId = body.postId || "default";
      customerName = body.customerName || "";
      imageUrl = body.imageUrl || "";
    }

    const record = {
      postId,
      customerName,
      imageUrl,
      updatedAt: new Date().toISOString(),
    };
    postMetadataStore.set(postId, record);

    return NextResponse.json({ success: true, metadata: record });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ أثناء حفظ البيانات";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId") || "default";
  const record = postMetadataStore.get(postId) || {
    postId,
    customerName: "",
    imageUrl: "",
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json({ success: true, metadata: record });
}
