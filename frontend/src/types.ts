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

export interface PresentationState {
  presentation_id: string;
  title: string;
  join_code: string;
  active_poll_index: number;
  total_polls: number;
  is_finished: boolean;
  active_poll: PollRead | null;
  results: PollResults | null;
}

export interface PresentationCreated {
  id: string;
  title: string;
  join_code: string;
  active_poll_index: number;
  is_finished: boolean;
  created_at: string;
  polls: PollRead[];
  admin_key: string;
}
