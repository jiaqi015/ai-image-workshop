import { handleBeke19Request } from "../server/beke19/beke19-api.mjs";

export const maxDuration = 120;

export default async function handler(req, res) {
  return handleBeke19Request(req, res);
}
