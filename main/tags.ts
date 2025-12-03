import fs from "fs";
import path from "path";

export function getTagFilePath(projectRoot: string) {
  return path.join(projectRoot, ".notepad-tags.json");
}

export function loadTags(projectRoot: string) {
  const tagFile = getTagFilePath(projectRoot);

  if (!fs.existsSync(tagFile)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(tagFile, "utf-8"));
  } catch {
    return {};
  }
}

export function saveTags(projectRoot: string, data: any) {
  const tagFile = getTagFilePath(projectRoot);
  fs.writeFileSync(tagFile, JSON.stringify(data, null, 2), "utf-8");
}

export function updateTags(projectRoot: string, itemPath: string, tags: any[]) {
  const allTags = loadTags(projectRoot);
  allTags[itemPath] = { tags };
  saveTags(projectRoot, allTags);
}

export function removeTags(projectRoot: string, itemPath: string) {
  const allTags = loadTags(projectRoot);
  delete allTags[itemPath];
  saveTags(projectRoot, allTags);
}
