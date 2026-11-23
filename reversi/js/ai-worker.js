// 계산 전용 Worker. 요청 번호는 화면에서 검사하여 취소된 대국의 응답을 버린다.
importScripts('../../common/core.js', 'logic.js');
self.onmessage = ({ data }) => {
  try {
    const move = Reversi.chooseMove(data.state, data.options || {});
    self.postMessage({ id: data.id, move });
  } catch {
    self.postMessage({ id: data.id, error: true });
  }
};
