import { ImageResult } from "../../types";

export interface IImageProvider {
  name: string;
  search(term: string, limit?: number): Promise<ImageResult[]>;
}
