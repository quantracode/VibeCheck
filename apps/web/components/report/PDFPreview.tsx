"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { ReportDocument, type ReportData } from "./ReportDocument";

interface PDFPreviewProps {
  data: ReportData;
}

export function PDFPreview({ data }: PDFPreviewProps) {
  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden">
      <PDFViewer width="100%" height="100%" showToolbar={false}>
        <ReportDocument data={data} />
      </PDFViewer>
    </div>
  );
}
