import * as migration_20260920_135351_initial from './20260920_135351_initial';

export const migrations = [
  {
    up: migration_20260920_135351_initial.up,
    down: migration_20260920_135351_initial.down,
    name: '20260920_135351_initial'
  },
];
