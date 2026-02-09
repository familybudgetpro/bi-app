import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export async function exportDashboardToPDF(
  target: HTMLElement | string = "main",
  fileName: string = "dashboard-report",
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [1440, 900], // Standard desktop resolution
  });

  const element =
    typeof target === "string"
      ? (document.querySelector(target) as HTMLElement)
      : target;

  if (!element) return;

  try {
    // Temporarily ensure visibility for capture
    const originalOverflow = element.style.overflow;
    element.style.overflow = "visible";

    const canvas = await html2canvas(element, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
      backgroundColor: null as any, // Allow transparent/theme background
    });

    element.style.overflow = originalOverflow;

    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();

    const imgProps = doc.getImageProperties(imgData);
    const ratio = imgProps.width / imgProps.height;
    const width = pdfWidth;
    const height = width / ratio;

    doc.addImage(imgData, "PNG", 0, 0, width, height);
    doc.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Export failed", error);
  }
}
