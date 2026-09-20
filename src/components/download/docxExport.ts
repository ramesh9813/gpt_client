import { Document, Packer, Paragraph, TextRun } from "docx";

export const buildDocxBlob = async (content: string) => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: content.split("\n").map(
          (line) =>
            new Paragraph({
              children: [new TextRun(line)],
            })
        ),
      },
    ],
  });

  return Packer.toBlob(doc);
};
