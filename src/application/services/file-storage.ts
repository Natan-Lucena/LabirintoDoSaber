export interface ISaveFileRequest {
  taskId: string;
  file: Express.Multer.File;
}

export interface ISaveFileResponse {
  url: string;
}

export interface FileStorage {
  saveFile({ taskId, file }: ISaveFileRequest): Promise<ISaveFileResponse>;
  // URL de um arquivo deste armazenamento (o mesmo de POST /task/upload-media).
  isStoredFileUrl(url: string): boolean;
}
