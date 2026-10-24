import Phaser from 'phaser';
import { COLORS, GAME_W } from '../config';

// Placeholder until S1-3 builds the grill.
export class GrillScene extends Phaser.Scene {
  constructor() {
    super('Grill');
  }

  create() {
    this.add.text(GAME_W / 2, 120, 'หม่าล่าริมทาง', { fontSize: '28px', color: COLORS.text }).setOrigin(0.5);
  }
}
