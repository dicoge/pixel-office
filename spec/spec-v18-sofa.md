# v18 — 右上角加一個沙發

## 需求
在 drawRoom() 中右上角區域新增 sofa-idle-v3.png

## 位置
約 x=1050, y=200（右上房間中央）

## 步驟

### 1. preload() 中載入 sofa
```javascript
this.load.image('sofa', '/sofa-idle-v3.png');
this.load.image('sofa_shadow', '/sofa-shadow-v1.png');
```

### 2. drawRoom() 中新增沙發
depth 3~5，scale 0.4~0.5，setOrigin(0.5)

### 3. 陰影
sofa-shadow-v1.png 放沙發 sprite 下方，depth 低一層

## 注意
不要動其他家具、角色。完成後 git push 到 master。