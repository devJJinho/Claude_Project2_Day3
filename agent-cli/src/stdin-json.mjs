// Claude Code 훅은 표준입력으로 JSON 하나를 통째로 준다. 이 헬퍼 하나로 모든 훅 진입점
// (guard/ask-question/permission)이 동일한 방식으로 읽는다.
export function readStdinJson() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on("error", reject);
  });
}
