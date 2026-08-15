// app.ts — 画个笑脸 (DAS): transparent-background drawing tool
document.addEventListener('DOMContentLoaded', function () {
  // 获取Canvas元素和上下文
  const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // 设置Canvas尺寸为容器大小
  function resizeCanvas(): void {
    const container = document.querySelector('.canvas-wrapper') as HTMLElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // 重新绘制历史记录
    redrawFromHistory();
  }

  // 调整画布大小
  let canvasScale = 1.0;
  const canvasWrapper = document.querySelector('.canvas-wrapper') as HTMLElement;

  function increaseCanvasSize(): void {
    if (canvasScale < 3.0) {
      canvasScale += 0.2;
      applyCanvasScale();
    }
  }

  function decreaseCanvasSize(): void {
    if (canvasScale > 0.5) {
      canvasScale -= 0.2;
      applyCanvasScale();
    }
  }

  function applyCanvasScale(): void {
    canvasWrapper.style.transform = `scale(${canvasScale})`;
    canvasWrapper.style.transformOrigin = 'center center';
  }

  document.getElementById('increaseCanvasBtn')!.addEventListener('click', increaseCanvasSize);
  document.getElementById('decreaseCanvasBtn')!.addEventListener('click', decreaseCanvasSize);

  // 初始化变量
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentTool = 'brush';
  let currentColor = '#000000';
  let brushSize = 5;
  let fontSize = 20;

  interface Textbox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
    content: string;
    rotation: number;
  }

  interface HistoryState {
    imageData: ImageData;
    textboxes: Textbox[];
  }

  let textboxes: Textbox[] = [];
  let activeTextbox: HTMLElement | null = null;
  let history: HistoryState[] = [];
  let historyIndex = -1;
  let isDraggingTextbox = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // 初始化Canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 保存当前状态到历史记录
  function saveState(): void {
    // 如果当前不在历史记录的最新位置，则删除当前位置之后的所有状态
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }

    // 保存当前Canvas状态
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 深拷贝文本框状态，包括所有尺寸和位置信息
    const textboxesCopy: Textbox[] = textboxes.map(box => ({
      id: box.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fontSize: box.fontSize,
      color: box.color,
      content: box.content,
      rotation: box.rotation || 0
    }));

    history.push({
      imageData: imageData,
      textboxes: textboxesCopy
    });
    historyIndex++;

    // 限制历史记录数量
    if (history.length > 20) {
      history.shift();
      historyIndex--;
    }

    updateUndoRedoButtons();
  }

  // 初始化时保存空白状态
  saveState();

  // 从历史记录重新绘制
  function redrawFromHistory(): void {
    if (historyIndex >= 0 && historyIndex < history.length) {
      const state = history[historyIndex];
      ctx.putImageData(state.imageData, 0, 0);

      // 使用深拷贝恢复文本框状态
      textboxes = state.textboxes.map(box => ({
        id: box.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fontSize: box.fontSize,
        color: box.color,
        content: box.content,
        rotation: box.rotation || 0
      }));

      // 重新渲染文本框
      renderTextboxes();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      textboxes = [];
      renderTextboxes();
    }
  }

  // 更新撤销/重做按钮状态
  function updateUndoRedoButtons(): void {
    (document.getElementById('undoBtn') as HTMLButtonElement).disabled = historyIndex <= 0;
    (document.getElementById('redoBtn') as HTMLButtonElement).disabled = historyIndex >= history.length - 1;
  }

  // 工具选择
  document.querySelectorAll('.tool-option[data-tool]').forEach(option => {
    option.addEventListener('click', function (this: HTMLElement) {
      // 移除所有工具的激活状态
      document.querySelectorAll('.tool-option[data-tool]').forEach(opt => {
        opt.classList.remove('active');
      });

      // 激活当前工具
      this.classList.add('active');
      currentTool = this.getAttribute('data-tool') || 'brush';

      // 显示对应的工具选项
      document.getElementById('brushOptions')!.style.display = 'none';
      document.getElementById('textOptions')!.style.display = 'none';
      document.getElementById('textboxControls')!.style.display = 'none';

      if (currentTool === 'brush') {
        document.getElementById('brushOptions')!.style.display = 'block';
      } else if (currentTool === 'text') {
        document.getElementById('textOptions')!.style.display = 'block';
        // 如果当前有活动文本框，显示文本框控制
        if (activeTextbox) {
          document.getElementById('textboxControls')!.style.display = 'flex';
        }
      } else if (currentTool === 'fill') {
        // 填充工具没有额外的设置
      }

      // 移除所有文本框的激活状态
      document.querySelectorAll('.textbox').forEach(box => {
        box.classList.remove('active');
      });
      activeTextbox = null;
    });
  });

  // 画笔大小滑块
  const brushSizeSlider = document.getElementById('brushSizeSlider') as HTMLInputElement;
  brushSizeSlider.addEventListener('input', function () {
    brushSize = parseInt((this as HTMLInputElement).value);
    document.getElementById('brushSizeValue')!.textContent = String(brushSize);
  });

  // 字体大小滑块
  const fontSizeSlider = document.getElementById('fontSizeSlider') as HTMLInputElement;
  fontSizeSlider.addEventListener('input', function () {
    fontSize = parseInt((this as HTMLInputElement).value);
    document.getElementById('fontSizeValue')!.textContent = String(fontSize);

    // 更新活动文本框的字体大小
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const textarea = activeTextbox.querySelector('.textbox-content') as HTMLElement;
      textarea.style.fontSize = fontSize + 'px';

      // 找到对应的文本框对象
      const textboxIndex = textboxes.findIndex(box => box.id === textboxId);
      if (textboxIndex !== -1) {
        const oldFontSize = textboxes[textboxIndex].fontSize;
        const scale = fontSize / oldFontSize;

        // 更新字体大小
        textboxes[textboxIndex].fontSize = fontSize;

        // 按比例调整文本框大小，保持长宽比
        const newWidth = textboxes[textboxIndex].width * scale;
        const newHeight = textboxes[textboxIndex].height * scale;

        // 确保最小尺寸
        if (newWidth >= 50 && newHeight >= 30) {
          textboxes[textboxIndex].width = newWidth;
          textboxes[textboxIndex].height = newHeight;

          // 更新DOM
          activeTextbox.style.width = newWidth + 'px';
          activeTextbox.style.height = newHeight + 'px';

          // 更新控制面板的值
          updateTextboxControlValues();
        }
      }
    }
  });

  // 颜色选择
  document.querySelectorAll('.color-option[data-color]').forEach(color => {
    color.addEventListener('click', function (this: HTMLElement) {
      document.querySelectorAll('.color-option[data-color]').forEach(c => {
        c.classList.remove('active');
      });
      this.classList.add('active');
      currentColor = this.getAttribute('data-color') || '#000000';

      // 更新活动文本框的颜色
      if (activeTextbox) {
        const textarea = activeTextbox.querySelector('.textbox-content') as HTMLElement;
        textarea.style.color = currentColor;
        updateTextboxColorInArray(activeTextbox.id, currentColor);
      }
    });
  });

  // 绘制函数
  function draw(x: number, y: number): void {
    if (!isDrawing) return;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastX = x;
    lastY = y;
  }

  interface Rgb {
    r: number;
    g: number;
    b: number;
  }

  // 改进的填充算法 - 边界填充算法 (修复版本)
  function floodFill(startX: number, startY: number, fillColor: string): void {
    // 获取Canvas的图像数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // 获取起始点的颜色
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];

    // 如果要填充的颜色与起始颜色相同，则不需要填充
    const fillRgb = hexToRgb(fillColor);
    if (colorsMatch(startR, startG, startB, startA, fillRgb.r, fillRgb.g, fillRgb.b, 255)) {
      return;
    }

    // 使用队列来实现广度优先搜索，避免递归栈溢出
    const queue: number[][] = [[startX, startY]];
    const visited = new Set<string>();
    const width = canvas.width;

    while (queue.length > 0) {
      const next = queue.shift()!;
      const x = next[0], y = next[1];

      // 检查是否在边界内
      if (x < 0 || x >= width || y < 0 || y >= canvas.height) {
        continue;
      }

      // 检查是否已经访问过
      const key = `${x},${y}`;
      if (visited.has(key)) {
        continue;
      }

      const pos = (y * width + x) * 4;

      // 检查当前像素颜色是否与起始颜色匹配
      const r = pixels[pos];
      const g = pixels[pos + 1];
      const b = pixels[pos + 2];
      const a = pixels[pos + 3];

      if (colorsMatch(r, g, b, a, startR, startG, startB, startA)) {
        // 填充颜色
        pixels[pos] = fillRgb.r;
        pixels[pos + 1] = fillRgb.g;
        pixels[pos + 2] = fillRgb.b;
        pixels[pos + 3] = 255;

        // 标记为已访问
        visited.add(key);

        // 将相邻像素加入队列
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);

        // 添加对角线方向的检查，避免边界未填充
        queue.push([x + 1, y + 1]);
        queue.push([x - 1, y - 1]);
        queue.push([x + 1, y - 1]);
        queue.push([x - 1, y + 1]);
      }
    }

    // 将修改后的图像数据放回Canvas
    ctx.putImageData(imageData, 0, 0);
  }

  // 辅助函数：比较颜色是否匹配
  function colorsMatch(r1: number, g1: number, b1: number, a1: number, r2: number, g2: number, b2: number, a2: number): boolean {
    // 允许一定的颜色容差
    const tolerance = 5; // 减小容差，避免填充到边界外
    return Math.abs(r1 - r2) <= tolerance &&
      Math.abs(g1 - g2) <= tolerance &&
      Math.abs(b1 - b2) <= tolerance &&
      Math.abs(a1 - a2) <= tolerance;
  }

  // 十六进制颜色转RGB
  function hexToRgb(hex: string): Rgb {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  // 填充函数
  function fillArea(x: number, y: number): void {
    floodFill(Math.floor(x), Math.floor(y), currentColor);
    saveState();
  }

  // 创建文本框
  function createTextbox(x: number, y: number): void {
    const textboxId = 'textbox-' + Date.now();
    const textbox = document.createElement('div');
    textbox.className = 'textbox';
    textbox.id = textboxId;
    textbox.style.left = (x - 50) + 'px';
    textbox.style.top = (y - 20) + 'px';
    textbox.style.width = '100px';
    textbox.style.height = '40px';
    textbox.style.transform = 'rotate(0deg)';

    const textarea = document.createElement('textarea');
    textarea.className = 'textbox-content';
    textarea.placeholder = '输入文字...';
    textarea.style.color = currentColor;
    textarea.style.fontSize = fontSize + 'px';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'textbox-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = '删除文本框';

    textbox.appendChild(textarea);
    textbox.appendChild(deleteBtn);
    (document.querySelector('.canvas-wrapper') as HTMLElement).appendChild(textbox);

    // 激活新创建的文本框
    activateTextbox(textbox);

    // 将文本框添加到数组
    textboxes.push({
      id: textboxId,
      x: x - 50,
      y: y - 20,
      width: 100,
      height: 40,
      fontSize: fontSize,
      color: currentColor,
      content: '',
      rotation: 0
    });

    // 更新控制面板的值
    updateTextboxControlValues();

    // 聚焦文本框
    textarea.focus();

    // 文本框事件
    textarea.addEventListener('input', function () {
      adjustTextboxSize(textbox);
      updateTextboxInArray(textboxId, textarea.value);
    });

    // 文本框删除按钮事件
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteTextbox(textbox);
    });

    // 文本框拖动
    textbox.addEventListener('mousedown', function (e) {
      if (e.target === deleteBtn) return;

      isDraggingTextbox = true;

      // 修复：使用正确的坐标计算
      // 获取文本框相对于canvas-wrapper的位置
      const canvasRect = (document.querySelector('.canvas-wrapper') as HTMLElement).getBoundingClientRect();

      // 计算鼠标在文本框内部的偏移量（相对于画布）
      dragOffsetX = e.clientX - canvasRect.left - textbox.offsetLeft;
      dragOffsetY = e.clientY - canvasRect.top - textbox.offsetTop;

      // 激活被拖动的文本框
      activateTextbox(textbox);

      function drag(e: MouseEvent): void {
        if (!isDraggingTextbox) return;

        // 修复：重新获取画布位置，确保准确性
        const canvasRect = (document.querySelector('.canvas-wrapper') as HTMLElement).getBoundingClientRect();
        const newX = e.clientX - canvasRect.left - dragOffsetX;
        const newY = e.clientY - canvasRect.top - dragOffsetY;

        // 限制在画布内
        const maxX = canvas.width - textbox.offsetWidth;
        const maxY = canvas.height - textbox.offsetHeight;

        textbox.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        textbox.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';

        // 更新文本框数组中保存的位置
        updateTextboxPositionInArray(
          textboxId,
          parseInt(textbox.style.left),
          parseInt(textbox.style.top)
        );

        // 更新控制面板
        updateTextboxControlValues();
      }

      function stopDrag(): void {
        isDraggingTextbox = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('mouseleave', stopDrag);

        // 保存状态
        saveState();
      }

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('mouseleave', stopDrag);
    });

    // 同样修复触摸事件
    textbox.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.target === deleteBtn) return;

      isDraggingTextbox = true;
      const touch = e.touches[0];

      // 修复：使用正确的坐标计算
      const canvasRect = (document.querySelector('.canvas-wrapper') as HTMLElement).getBoundingClientRect();

      dragOffsetX = touch.clientX - canvasRect.left - textbox.offsetLeft;
      dragOffsetY = touch.clientY - canvasRect.top - textbox.offsetTop;

      activateTextbox(textbox);

      function drag(e: TouchEvent): void {
        if (!isDraggingTextbox) return;

        const touch = e.touches[0];
        const canvasRect = (document.querySelector('.canvas-wrapper') as HTMLElement).getBoundingClientRect();
        const newX = touch.clientX - canvasRect.left - dragOffsetX;
        const newY = touch.clientY - canvasRect.top - dragOffsetY;

        const maxX = canvas.width - textbox.offsetWidth;
        const maxY = canvas.height - textbox.offsetHeight;

        textbox.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        textbox.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';

        updateTextboxPositionInArray(
          textboxId,
          parseInt(textbox.style.left),
          parseInt(textbox.style.top)
        );

        updateTextboxControlValues();
      }

      function stopDrag(): void {
        isDraggingTextbox = false;
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);

        saveState();
      }

      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('touchend', stopDrag);
    }, { passive: false });

    // 触摸事件支持
    textbox.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.target === deleteBtn) return;

      isDraggingTextbox = true;
      const touch = e.touches[0];
      const rect = textbox.getBoundingClientRect();
      dragOffsetX = touch.clientX - rect.left;
      dragOffsetY = touch.clientY - rect.top;

      // 激活被拖动的文本框
      activateTextbox(textbox);

      function drag(e: TouchEvent): void {
        if (!isDraggingTextbox) return;

        const touch = e.touches[0];
        const newX = touch.clientX - dragOffsetX;
        const newY = touch.clientY - dragOffsetY;

        // 限制在画布内
        const maxX = canvas.width - textbox.offsetWidth;
        const maxY = canvas.height - textbox.offsetHeight;

        textbox.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        textbox.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';

        // 更新文本框数组中保存的位置
        updateTextboxPositionInArray(
          textboxId,
          parseInt(textbox.style.left),
          parseInt(textbox.style.top)
        );

        // 更新控制面板
        updateTextboxControlValues();
      }

      function stopDrag(): void {
        isDraggingTextbox = false;
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);

        // 保存状态
        saveState();
      }

      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('touchend', stopDrag);
    }, { passive: false });

    // 点击外部时取消激活文本框
    document.addEventListener('click', function (e) {
      if (!textbox.contains(e.target as Node | null) && e.target !== textbox) {
        deactivateAllTextboxes();
      }
    }, { once: true });

    saveState();
  }

  // 删除文本框
  function deleteTextbox(textbox: HTMLElement): void {
    const textboxId = textbox.id;

    // 从DOM中移除
    textbox.remove();

    // 从数组中移除
    const index = textboxes.findIndex(box => box.id === textboxId);
    if (index !== -1) {
      textboxes.splice(index, 1);
    }

    // 如果删除的是活动文本框，清空活动文本框
    if (activeTextbox && activeTextbox.id === textboxId) {
      activeTextbox = null;
      // 隐藏文本框控制面板
      document.getElementById('textboxControls')!.style.display = 'none';
    }

    saveState();
  }

  // 调整文本框大小以适应内容
  function adjustTextboxSize(textbox: HTMLElement): void {
    const textarea = textbox.querySelector('.textbox-content') as HTMLElement;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    textbox.style.width = (textarea.scrollWidth + 20) + 'px';
    textbox.style.height = (textarea.scrollHeight + 10) + 'px';

    // 更新文本框数组中保存的尺寸
    const textboxId = textbox.id;
    updateTextboxSizeInArray(textboxId, textbox.offsetWidth, textbox.offsetHeight);

    // 更新控制面板
    updateTextboxControlValues();
  }

  // 激活文本框
  function activateTextbox(textbox: HTMLElement): void {
    deactivateAllTextboxes();
    textbox.classList.add('active');
    activeTextbox = textbox;

    // 显示文本框控制面板
    if (currentTool === 'text') {
      document.getElementById('textboxControls')!.style.display = 'flex';
    }

    // 更新字体大小滑块
    const textarea = textbox.querySelector('.textbox-content') as HTMLElement;
    const computedStyle = window.getComputedStyle(textarea);
    const currentFontSize = parseInt(computedStyle.fontSize);
    fontSize = currentFontSize;
    fontSizeSlider.value = String(currentFontSize);
    document.getElementById('fontSizeValue')!.textContent = String(currentFontSize);

    // 更新颜色选择
    const boxColor = textarea.style.color || '#000000';
    document.querySelectorAll('.color-option[data-color]').forEach(color => {
      if (color.getAttribute('data-color') === boxColor) {
        color.classList.add('active');
      } else {
        color.classList.remove('active');
      }
    });

    // 更新控制面板的值
    updateTextboxControlValues();
  }

  // 取消激活所有文本框
  function deactivateAllTextboxes(): void {
    document.querySelectorAll('.textbox').forEach(box => {
      box.classList.remove('active');
    });
    activeTextbox = null;

    // 隐藏文本框控制面板
    document.getElementById('textboxControls')!.style.display = 'none';
  }

  // 更新文本框数组中的内容
  function updateTextboxInArray(id: string, content: string): void {
    const index = textboxes.findIndex(box => box.id === id);
    if (index !== -1) {
      textboxes[index].content = content;
    }
  }

  // 更新文本框数组中的尺寸
  function updateTextboxSizeInArray(id: string, width: number, height: number): void {
    const index = textboxes.findIndex(box => box.id === id);
    if (index !== -1) {
      textboxes[index].width = width;
      textboxes[index].height = height;
    }
  }

  // 更新文本框数组中的位置
  function updateTextboxPositionInArray(id: string, x: number, y: number): void {
    const index = textboxes.findIndex(box => box.id === id);
    if (index !== -1) {
      textboxes[index].x = x;
      textboxes[index].y = y;
    }
  }

  // 更新文本框数组中的颜色
  function updateTextboxColorInArray(id: string, color: string): void {
    const index = textboxes.findIndex(box => box.id === id);
    if (index !== -1) {
      textboxes[index].color = color;
    }
  }

  // 更新文本框数组中的旋转角度
  function updateTextboxRotationInArray(id: string, rotation: number): void {
    const index = textboxes.findIndex(box => box.id === id);
    if (index !== -1) {
      textboxes[index].rotation = rotation;
    }
  }

  // 更新文本框控制面板的值
  function updateTextboxControlValues(): void {
    if (!activeTextbox) return;

    const textboxId = activeTextbox.id;
    const index = textboxes.findIndex(box => box.id === textboxId);
    if (index !== -1) {
      const box = textboxes[index];
      document.getElementById('widthValue')!.textContent = String(Math.round(box.width));
      document.getElementById('heightValue')!.textContent = String(Math.round(box.height));
      document.getElementById('rotationIndicator')!.textContent = Math.round(box.rotation) + '°';
    }
  }

  // 渲染所有文本框
  function renderTextboxes(): void {
    // 移除所有现有的文本框
    document.querySelectorAll('.textbox').forEach(box => box.remove());

    // 重新创建所有文本框
    textboxes.forEach(box => {
      const textbox = document.createElement('div');
      textbox.className = 'textbox';
      textbox.id = box.id;
      textbox.style.left = box.x + 'px';
      textbox.style.top = box.y + 'px';
      textbox.style.width = box.width + 'px';
      textbox.style.height = box.height + 'px';
      textbox.style.transform = `rotate(${box.rotation}deg)`;

      const textarea = document.createElement('textarea');
      textarea.className = 'textbox-content';
      textarea.value = box.content;
      textarea.style.color = box.color;
      textarea.style.fontSize = box.fontSize + 'px';

      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'textbox-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = '删除文本框';

      textbox.appendChild(textarea);
      textbox.appendChild(deleteBtn);
      (document.querySelector('.canvas-wrapper') as HTMLElement).appendChild(textbox);

      // 重新绑定事件
      textarea.addEventListener('input', function () {
        adjustTextboxSize(textbox);
        updateTextboxInArray(box.id, textarea.value);
      });

      // 删除按钮事件
      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteTextbox(textbox);
      });

      // 文本框拖动事件
      textbox.addEventListener('mousedown', function (e) {
        if (e.target === deleteBtn) return;

        isDraggingTextbox = true;
        const rect = textbox.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        activateTextbox(textbox);

        function drag(e: MouseEvent): void {
          if (!isDraggingTextbox) return;

          const newX = e.clientX - dragOffsetX;
          const newY = e.clientY - dragOffsetY;

          const maxX = canvas.width - textbox.offsetWidth;
          const maxY = canvas.height - textbox.offsetHeight;

          textbox.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
          textbox.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';

          updateTextboxPositionInArray(
            box.id,
            parseInt(textbox.style.left),
            parseInt(textbox.style.top)
          );

          updateTextboxControlValues();
        }

        function stopDrag(): void {
          isDraggingTextbox = false;
          document.removeEventListener('mousemove', drag);
          document.removeEventListener('mouseup', stopDrag);
          document.removeEventListener('mouseleave', stopDrag);
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('mouseleave', stopDrag);
      });

      // 触摸事件支持
      textbox.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (e.target === deleteBtn) return;

        isDraggingTextbox = true;
        const touch = e.touches[0];
        const rect = textbox.getBoundingClientRect();
        dragOffsetX = touch.clientX - rect.left;
        dragOffsetY = touch.clientY - rect.top;

        activateTextbox(textbox);

        function drag(e: TouchEvent): void {
          if (!isDraggingTextbox) return;

          const touch = e.touches[0];
          const newX = touch.clientX - dragOffsetX;
          const newY = touch.clientY - dragOffsetY;

          const maxX = canvas.width - textbox.offsetWidth;
          const maxY = canvas.height - textbox.offsetHeight;

          textbox.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
          textbox.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';

          updateTextboxPositionInArray(
            box.id,
            parseInt(textbox.style.left),
            parseInt(textbox.style.top)
          );

          updateTextboxControlValues();
        }

        function stopDrag(): void {
          isDraggingTextbox = false;
          document.removeEventListener('touchmove', drag);
          document.removeEventListener('touchend', stopDrag);
        }

        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', stopDrag);
      }, { passive: false });

      // 点击激活
      textbox.addEventListener('click', function (e) {
        if (e.target !== deleteBtn) {
          activateTextbox(textbox);
        }
      });

      // 触摸激活
      textbox.addEventListener('touchstart', function (e) {
        if (e.target !== deleteBtn) {
          activateTextbox(textbox);
        }
      }, { passive: false });
    });
  }

  // 文本框控制按钮事件
  document.getElementById('increaseWidthBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newWidth = textboxes[index].width + 10;
        textboxes[index].width = newWidth;
        activeTextbox.style.width = newWidth + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('decreaseWidthBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newWidth = Math.max(50, textboxes[index].width - 10);
        textboxes[index].width = newWidth;
        activeTextbox.style.width = newWidth + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('increaseHeightBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newHeight = textboxes[index].height + 10;
        textboxes[index].height = newHeight;
        activeTextbox.style.height = newHeight + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('decreaseHeightBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newHeight = Math.max(30, textboxes[index].height - 10);
        textboxes[index].height = newHeight;
        activeTextbox.style.height = newHeight + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  // 位置控制按钮
  document.getElementById('moveUpBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newY = Math.max(0, textboxes[index].y - 5);
        textboxes[index].y = newY;
        activeTextbox.style.top = newY + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('moveDownBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newY = Math.min(canvas.height - textboxes[index].height, textboxes[index].y + 5);
        textboxes[index].y = newY;
        activeTextbox.style.top = newY + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('moveLeftBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newX = Math.max(0, textboxes[index].x - 5);
        textboxes[index].x = newX;
        activeTextbox.style.left = newX + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('moveRightBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newX = Math.min(canvas.width - textboxes[index].width, textboxes[index].x + 5);
        textboxes[index].x = newX;
        activeTextbox.style.left = newX + 'px';
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  // 旋转控制按钮
  document.getElementById('rotateCWBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newRotation = (textboxes[index].rotation + 15) % 360;
        textboxes[index].rotation = newRotation;
        activeTextbox.style.transform = `rotate(${newRotation}deg)`;
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  document.getElementById('rotateCCWBtn')!.addEventListener('click', function () {
    if (activeTextbox) {
      const textboxId = activeTextbox.id;
      const index = textboxes.findIndex(box => box.id === textboxId);
      if (index !== -1) {
        const newRotation = (textboxes[index].rotation - 15 + 360) % 360;
        textboxes[index].rotation = newRotation;
        activeTextbox.style.transform = `rotate(${newRotation}deg)`;
        updateTextboxControlValues();
        saveState();
      }
    }
  });

  // 鼠标/触摸事件处理
  function startDrawing(e: MouseEvent): void {
    if (currentTool === 'text') {
      // 对于文本工具，在点击位置创建文本框
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 检查是否点击了现有文本框
      const clickedTextbox = Array.from(document.querySelectorAll('.textbox')).find(box => {
        const boxRect = box.getBoundingClientRect();
        return x >= boxRect.left - rect.left &&
          x <= boxRect.right - rect.left &&
          y >= boxRect.top - rect.top &&
          y <= boxRect.bottom - rect.top;
      });

      if (!clickedTextbox) {
        createTextbox(x, y);
      }
      return;
    }

    if (currentTool === 'fill') {
      // 对于填充工具，填充点击区域
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      fillArea(x, y);
      return;
    }

    // 对于画笔工具，开始绘制
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];

    // 立即画一个点
    ctx.beginPath();
    ctx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
  }

  function stopDrawing(): void {
    if (!isDrawing) return;
    isDrawing = false;
    saveState();
  }

  // 绑定鼠标事件
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    draw(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // 绑定触摸事件
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
  });

  // 清空画布
  document.getElementById('clearBtn')!.addEventListener('click', function () {
    if (confirm('确定要清空画布吗？所有内容将被清除。')) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      textboxes = [];
      document.querySelectorAll('.textbox').forEach(box => box.remove());
      deactivateAllTextboxes();
      saveState();
    }
  });

  // 撤销功能
  document.getElementById('undoBtn')!.addEventListener('click', function () {
    if (historyIndex > 0) {
      historyIndex--;
      redrawFromHistory();
      updateUndoRedoButtons();
    }
  });

  // 重做功能
  document.getElementById('redoBtn')!.addEventListener('click', function () {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      redrawFromHistory();
      updateUndoRedoButtons();
    }
  });

  // 保存功能
  document.getElementById('saveBtn')!.addEventListener('click', function () {
    // 创建临时Canvas来绘制最终图像
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // 填充透明背景
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 绘制主Canvas内容
    tempCtx.drawImage(canvas, 0, 0);

    // 绘制所有文本框内容
    textboxes.forEach(box => {
      tempCtx.save();

      // 移动到文本框中心
      tempCtx.translate(box.x + box.width / 2, box.y + box.height / 2);

      // 应用旋转
      tempCtx.rotate(box.rotation * Math.PI / 180);

      // 设置字体和颜色
      tempCtx.font = `${box.fontSize}px Arial`;
      tempCtx.fillStyle = box.color;
      tempCtx.textBaseline = 'middle';
      tempCtx.textAlign = 'center';

      // 处理换行文本
      const lines = box.content.split('\n');
      const lineHeight = box.fontSize;
      const totalHeight = lines.length * lineHeight;
      const startY = -totalHeight / 2 + lineHeight / 2;

      lines.forEach((line, index) => {
        tempCtx.fillText(line, 0, startY + (index * lineHeight));
      });

      tempCtx.restore();
    });

    // 创建下载链接
    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = '我的绘画-' + new Date().getTime() + '.png';
    link.href = dataURL;

    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 显示通知
    showNotification('图片已保存到您的设备');
  });

  // 显示通知
  function showNotification(message: string): void {
    const notification = document.getElementById('notification')!;
    notification.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
  }

  // 初始选择画笔
  document.getElementById('brushTool')!.click();

  // 初始选择第一个颜色
  (document.querySelector('.color-option[data-color="#000000"]') as HTMLElement)!.click();
});
