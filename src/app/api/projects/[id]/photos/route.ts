import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConfig } from "@/lib/airtable/client";
import { getProject, mapProject } from "@/lib/airtable/projects";
import { canEditProject } from "@/lib/projectRules";
import { ProjectError, withProjectLock } from "@/lib/projectService";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    return await withProjectLock(params.id, async () => {
      const record = await getProject(params.id);
      const project = record ? mapProject(record) : null;
      if (!project || project.ownerId !== session.user.personId || !canEditProject(project.state)) throw new ProjectError("This project is not available for photo uploads.");
      const form = await request.formData();
      const file = form.get("file"), kind = form.get("kind");
      if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) throw new ProjectError("Choose a JPG, PNG or WebP photo up to 5 MB.");
      if (kind !== "items" && kind !== "delivery") throw new ProjectError("Choose the photo's purpose.");
      if ((kind === "items" ? project.itemPhotos : project.deliveryPhotos).length >= 10) throw new ProjectError("A maximum of 10 photos per category is supported.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
      if (!valid) throw new ProjectError("The file does not match its image format.");
      const { baseId, apiKey } = getConfig();
      const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
      const schemaResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers, cache: "no-store" });
      if (!schemaResponse.ok) throw new Error("Schema unavailable");
      const schema = await schemaResponse.json() as { tables: Array<{ name: string; fields: Array<{ id: string; name: string }> }> };
      const field = schema.tables.find(t => t.name === "Projects")?.fields.find(f => f.name === (kind === "items" ? "Item Photos" : "Delivery Photos"));
      if (!field) throw new Error("Photo configuration missing");
      const response = await fetch(`https://content.airtable.com/v0/${baseId}/${params.id}/${field.id}/uploadAttachment`, { method: "POST", headers, body: JSON.stringify({ contentType: file.type, filename: file.name.slice(0, 200), file: bytes.toString("base64") }) });
      if (!response.ok) throw new Error("Upload failed");
      return NextResponse.json({ project: mapProject((await getProject(params.id))!) });
    });
  } catch (error) { return NextResponse.json({ error: error instanceof ProjectError ? error.message : "Photo upload failed. Refresh to check before retrying." }, { status: error instanceof ProjectError ? 422 : 503 }); }
}
