export function printSheet(sheetClass: string, useCompactLayout = false): void {
  const mobilePrintClass = 'printing-mobile-sheet';
  const useMobileLayout = useCompactLayout || window.matchMedia('(max-width: 640px)').matches;

  document.body.classList.add(sheetClass);
  if (useMobileLayout) {
    document.body.classList.add(mobilePrintClass);
  }

  const printPageStyle = useCompactLayout ? document.createElement('style') : null;
  const cleanup = () => {
    printPageStyle?.remove();
    document.body.classList.remove(sheetClass, mobilePrintClass);
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    if (printPageStyle) {
      printPageStyle.media = 'print';
      printPageStyle.textContent = '@page { size: A4 portrait; margin: 0; }';
      document.head.append(printPageStyle);
    }

    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
