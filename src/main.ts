import Phaser from 'phaser';
import { BattleScene } from './render/battle';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0c0e10',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [BattleScene],
  input: { mouse: { preventDefaultWheel: true } },
});
