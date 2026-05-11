import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing";

export const maxDuration = 60;

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
