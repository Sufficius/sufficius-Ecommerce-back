import { MultipartFile } from "@fastify/multipart";

export type MultipartField = MultipartFile & {
    value: string;
};

export type MultipartBody = {
    [key: string]: MultipartFile;
};
