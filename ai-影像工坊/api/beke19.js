import { handleBeke19Request } from "../server/beke19/beke19-api.mjs";

export default async function handler(req, res) {
  return handleBeke19Request(req, res);
}
