export interface ListContentQuery {
  assetId?: string;
  platform?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface ListCommentsQuery extends ListContentQuery {
  postId?: string;
}

export interface SyncContentDto {
  assetId?: string;
}
