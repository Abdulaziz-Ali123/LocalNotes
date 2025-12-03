export async function loadTagMap(projectRoot: string) {
  return await (window as any).electron.invoke("tags:load", projectRoot);
}

export async function updateTag(itemPath: string, projectRoot: string, tags: any[]) {
  return await (window as any).electron.invoke("tags:update", projectRoot, itemPath, tags);
}

export async function removeTag(itemPath: string, projectRoot: string) {
  return await (window as any).electron.invoke("tags:remove", projectRoot, itemPath);
}