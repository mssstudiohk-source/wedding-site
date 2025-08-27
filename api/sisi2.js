if (req.query.debug) {
  return res.status(200).json({
    ok: true,
    steps: conversationFlow.steps || [],
    flows: replyFlow.flows || []
  });
}
