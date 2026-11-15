export interface OptionRead {
  id: number;
  text: string;
  position: number;
}

export interface PollRead {
  id: string;
  question: string;
  created_at: string;
  closes_at: string | null;
  is_closed: boolean;
  options: OptionRead[];
  admin_key?: string;
}

export interface OptionResult {
  id: number;
  text: string;
  position: number;
  vote_count: number;
}

export interface PollResults {
  poll_id: string;
  question: string;
  is_closed: boolean;
  total_votes: number;
  results: OptionResult[];
}
