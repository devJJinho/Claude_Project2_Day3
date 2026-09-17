// backlog CLI 전용 사용자 오류 타입. 예상치 못한 예외와 구분해 exit code/메시지를 다르게 처리한다.
export class CliError extends Error {}
