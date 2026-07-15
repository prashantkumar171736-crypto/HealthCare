import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "../login/route";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  return await validateSession(sessionToken);
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Helper to determine the target collection from the type query param
function getCollectionName(type: string): string {
  switch (type) {
    case "diseases":
      return "diseases";
    case "library":
      return "library";
    case "tips":
      return "tips";
    case "faq":
      return "faq";
    case "posts":
    default:
      return "posts";
  }
}

/** GET /api/admin/content?type=<type> — List all items of a given type */
export async function GET(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts";
    const collection = getCollectionName(type);
    const db = await getDb();

    let items;
    if (collection === "posts") {
      items = await db.collection(collection).find({}).sort({ title: 1 }).toArray();
    } else if (collection === "diseases") {
      items = await db.collection(collection).find({}).sort({ name: 1 }).toArray();
    } else if (collection === "library") {
      items = await db.collection(collection).find({}).sort({ title: 1 }).toArray();
    } else if (collection === "tips") {
      items = await db.collection(collection).find({}).sort({ category: 1, title: 1 }).toArray();
    } else {
      items = await db.collection(collection).find({}).toArray();
    }

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/content?type=<type> — Create a new item of a given type */
export async function POST(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts";
    const collection = getCollectionName(type);
    const body = await req.json();
    const db = await getDb();
    const now = new Date();

    let doc: any = { createdAt: now, updatedAt: now };

    if (collection === "posts") {
      const { title, content } = body;
      if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
      const letter = title.trim()[0].toUpperCase();
      doc.title = title.trim();
      doc.content = content;
      doc.category = /^[A-Z]$/.test(letter) ? letter : "#";
      doc.slug = slugify(title);
    } else if (collection === "diseases") {
      const { name, categories, overview, symptoms, causes, riskFactors, whenToSeeDoctor, diagnosis, treatmentOptions, prevention, faq, relatedDiseases } = body;
      if (!name) return NextResponse.json({ error: "Disease name is required" }, { status: 400 });
      doc.name = name.trim();
      doc.slug = slugify(name);
      doc.categories = Array.isArray(categories) ? categories : [];
      doc.overview = overview || "";
      doc.symptoms = Array.isArray(symptoms) ? symptoms : (symptoms || "");
      doc.causes = Array.isArray(causes) ? causes : (causes || "");
      doc.riskFactors = Array.isArray(riskFactors) ? riskFactors : (riskFactors || "");
      doc.whenToSeeDoctor = whenToSeeDoctor || "";
      doc.diagnosis = diagnosis || "";
      doc.treatmentOptions = Array.isArray(treatmentOptions) ? treatmentOptions : (treatmentOptions || "");
      doc.prevention = prevention || "";
      doc.faq = Array.isArray(faq) ? faq : [];
      doc.relatedDiseases = Array.isArray(relatedDiseases) ? relatedDiseases : [];
    } else if (collection === "library") {
      const { title, type: libType, description, content } = body;
      if (!title || !libType) return NextResponse.json({ error: "Title and type are required" }, { status: 400 });
      doc.title = title.trim();
      doc.slug = slugify(title);
      doc.type = libType;
      doc.description = description || "";
      doc.content = content || "";
    } else if (collection === "tips") {
      const { title, category, body: tipBody, icon, tag, tagColor } = body;
      if (!title || !category) return NextResponse.json({ error: "Title and category are required" }, { status: 400 });
      doc.title = title.trim();
      doc.category = category;
      doc.body = tipBody || "";
      doc.icon = icon || "💡";
      doc.tag = tag || "";
      doc.tagColor = tagColor || "var(--primary)";
    } else if (collection === "faq") {
      const { q, a } = body;
      if (!q || !a) return NextResponse.json({ error: "Question and Answer are required" }, { status: 400 });
      doc.q = q.trim();
      doc.a = a.trim();
    }

    const result = await db.collection(collection).insertOne(doc);
    return NextResponse.json({ message: "Content created successfully", id: result.insertedId.toString(), item: doc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/admin/content?type=<type>&id=<id> — Update an existing item */
export async function PUT(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts";
    const id = searchParams.get("id");
    const collection = getCollectionName(type);
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const body = await req.json();
    const db = await getDb();
    let updateDoc: any = { updatedAt: new Date() };

    if (collection === "posts") {
      const { title, content } = body;
      if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
      const letter = title.trim()[0].toUpperCase();
      updateDoc.title = title.trim();
      updateDoc.content = content;
      updateDoc.category = /^[A-Z]$/.test(letter) ? letter : "#";
      updateDoc.slug = slugify(title);
    } else if (collection === "diseases") {
      const { name, categories, overview, symptoms, causes, riskFactors, whenToSeeDoctor, diagnosis, treatmentOptions, prevention, faq, relatedDiseases } = body;
      if (!name) return NextResponse.json({ error: "Disease name is required" }, { status: 400 });
      updateDoc.name = name.trim();
      updateDoc.slug = slugify(name);
      updateDoc.categories = Array.isArray(categories) ? categories : [];
      updateDoc.overview = overview || "";
      updateDoc.symptoms = Array.isArray(symptoms) ? symptoms : (symptoms || "");
      updateDoc.causes = Array.isArray(causes) ? causes : (causes || "");
      updateDoc.riskFactors = Array.isArray(riskFactors) ? riskFactors : (riskFactors || "");
      updateDoc.whenToSeeDoctor = whenToSeeDoctor || "";
      updateDoc.diagnosis = diagnosis || "";
      updateDoc.treatmentOptions = Array.isArray(treatmentOptions) ? treatmentOptions : (treatmentOptions || "");
      updateDoc.prevention = prevention || "";
      updateDoc.faq = Array.isArray(faq) ? faq : [];
      updateDoc.relatedDiseases = Array.isArray(relatedDiseases) ? relatedDiseases : [];
    } else if (collection === "library") {
      const { title, type: libType, description, content } = body;
      if (!title || !libType) return NextResponse.json({ error: "Title and type are required" }, { status: 400 });
      updateDoc.title = title.trim();
      updateDoc.slug = slugify(title);
      updateDoc.type = libType;
      updateDoc.description = description || "";
      updateDoc.content = content || "";
    } else if (collection === "tips") {
      const { title, category, body: tipBody, icon, tag, tagColor } = body;
      if (!title || !category) return NextResponse.json({ error: "Title and category are required" }, { status: 400 });
      updateDoc.title = title.trim();
      updateDoc.category = category;
      updateDoc.body = tipBody || "";
      updateDoc.icon = icon || "💡";
      updateDoc.tag = tag || "";
      updateDoc.tagColor = tagColor || "var(--primary)";
    } else if (collection === "faq") {
      const { q, a } = body;
      if (!q || !a) return NextResponse.json({ error: "Question and Answer are required" }, { status: 400 });
      updateDoc.q = q.trim();
      updateDoc.a = a.trim();
    }

    const result = await db.collection(collection).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Content updated successfully", item: updateDoc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/content?type=<type>&id=<id> — Delete an item */
export async function DELETE(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts";
    const id = searchParams.get("id");
    const collection = getCollectionName(type);
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const db = await getDb();
    const result = await db.collection(collection).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Content deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
