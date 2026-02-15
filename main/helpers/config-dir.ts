import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import os from "os";
import path from "path";

const APP_CONFIG_DIR_NAME = "LocalNotes";

const getBaseDataDirectory = (): string => {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }

  return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
};

export const resolveConfigDirectoryPath = (): string => {
  const baseDataDirectory = getBaseDataDirectory();
  return path.join(baseDataDirectory, APP_CONFIG_DIR_NAME);
};

export const ensureConfigDirectory = async (): Promise<string> => {
  const configDirectoryPath = resolveConfigDirectoryPath();
  let directoryAlreadyExists = false;

  try {
    await fs.access(configDirectoryPath, fsConstants.F_OK);
    directoryAlreadyExists = true;
  } catch {
    directoryAlreadyExists = false;
  }

  await fs.mkdir(configDirectoryPath, {
    recursive: true,
    mode: 0o700,
  });

  if (process.platform !== "win32") {
    await fs.chmod(configDirectoryPath, 0o700);
  }

  await fs.access(configDirectoryPath, fsConstants.R_OK | fsConstants.W_OK);

  const statusMessage = directoryAlreadyExists
    ? `[Local Notes] Config directory already exists: ${configDirectoryPath}`
    : `[Local Notes] Config directory created: ${configDirectoryPath}`;

  process.stdout.write(`${statusMessage}\n`);
  process.stderr.write(`${statusMessage}\n`);

  if (directoryAlreadyExists) {
    console.log(statusMessage);
  } else {
    console.log(statusMessage);
  }

  return configDirectoryPath;
};

export const getConfigDirectoryPath = (): string => {
  return getBaseDataDirectory() + "/" + APP_CONFIG_DIR_NAME;
};
