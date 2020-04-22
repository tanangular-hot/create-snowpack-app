const path = require("path");
const babelParser = require("@babel/parser");

function importCSZ() {
  return babelParser.parse(`import css from 'csz';`, {
    plugins: ["importMeta"],
    sourceType: "module",
  });
}

function loadCSZ(val, spec) {
  return babelParser.parse(
    `const ${spec} = css\`\$\{new URL('${val}', import.meta.url).pathname\}\`;`,
    { plugins: ["importMeta"], sourceType: "module" }
  );
}

function loadCSS(val) {
  return babelParser.parseExpression(
    `\n(() => {
    const linkEl = document.createElement("link");
    linkEl.href = new URL('${val}', import.meta.url).pathname;
    linkEl.type = "text/css";
    linkEl.rel = "stylesheet";
    document.head.appendChild(linkEl);
  })()\n`,
    { plugins: ["importMeta"], sourceType: "module" }
  );
}

function loadAssetURL(val) {
  return babelParser.parseExpression(
    `new URL('${val}', import.meta.url).pathname`,
    { plugins: ["importMeta"], sourceType: "module" }
  );
}

module.exports = function pikaWebBabelTransform(
  { types: t, env },
  { csz } = { csz: false }
) {
  return {
    visitor: {
      ImportDeclaration(p, { file, opts }) {
        const source = p.get("source");
        // An export without a 'from' clause
        if (!source.node) {
          return;
        }
        const specs = p.get("specifiers") || [];
        const hasNoImportRefs = specs.length === 0;
        const defaultImportRef = specs.find(
          (s) => s.type === "ImportDefaultSpecifier"
        );
        const ext = path.extname(source.node.value);
        switch (ext) {
          case ".js":
          case ".jsx":
          case ".ts":
          case ".tsx":
          case "":
            return;

          case ".css":
            if (hasNoImportRefs) {
              // warn about flash of content
              p.insertBefore(loadCSS(source.node.value));
              p.remove();
              return;
            }
            if (!defaultImportRef || specs.length > 1) {
              // throw an error / return.
              return;
            }
            if (!csz) {
              // throw an error / return.
              return;
            }
            if (!this.hasCSZImport) {
              p.insertBefore(importCSZ());
              this.hasCSZImport = true;
            }
            p.insertBefore(
              loadCSZ(source.node.value, defaultImportRef.node.local.name)
            );
            p.remove();
            return;

          default:
            if (!defaultImportRef || specs.length > 1) {
              // throw an error / return.
              return;
            }
            p.insertBefore(
              t.variableDeclaration("const", [
                t.variableDeclarator(
                  t.identifier(defaultImportRef.node.local.name),
                  loadAssetURL(source.node.value)
                ),
              ])
            );
            p.remove();
        }
      },
    },
  };
};