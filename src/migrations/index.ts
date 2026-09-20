import * as migration_20260920_135351_initial from './20260920_135351_initial';
import * as migration_20260920_150530_media_files from './20260920_150530_media_files';

export const migrations = [
  {
    up: migration_20260920_135351_initial.up,
    down: migration_20260920_135351_initial.down,
    name: '20260920_135351_initial',
  },
  {
    up: migration_20260920_150530_media_files.up,
    down: migration_20260920_150530_media_files.down,
    name: '20260920_150530_media_files'
  },
];
