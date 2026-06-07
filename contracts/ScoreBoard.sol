// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ScoreBoard
 * @notice Lưu username + điểm thắng cho SMIC GAME HUB trên Seismic Testnet
 *
 * Quyền hạn:
 *  - Bất kỳ ai  → setUsername(), getProfile(), getLeaderboard()
 *  - Chỉ owner  → addScore(), resetScore(), transferOwnership()
 */
contract ScoreBoard {

    // ── Struct ────────────────────────────────────────────────
    struct Player {
        string  username;
        uint256 score;
        uint32  wins;
        bool    exists;
    }

    // ── Storage ───────────────────────────────────────────────
    address public owner;
    mapping(address => Player) private players;
    address[] private playerList;   // danh sách tất cả địa chỉ đã đăng ký

    // ── Events ────────────────────────────────────────────────
    event UsernameSet(address indexed player, string username);
    event ScoreAdded(address indexed player, uint256 points, uint256 totalScore, uint32 wins);
    event ScoreReset(address indexed player);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ── Modifier ──────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "ScoreBoard: caller is not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Username (public) ─────────────────────────────────────

    /**
     * @notice Đặt hoặc thay đổi username của người gọi
     * @param  _username Tên hiển thị (1–24 ký tự)
     */
    function setUsername(string calldata _username) external {
        bytes memory b = bytes(_username);
        require(b.length >= 1 && b.length <= 24, "Username: 1-24 chars");

        if (!players[msg.sender].exists) {
            playerList.push(msg.sender);
            players[msg.sender].exists = true;
        }
        players[msg.sender].username = _username;
        emit UsernameSet(msg.sender, _username);
    }

    // ── Score (owner only) ────────────────────────────────────

    /**
     * @notice Thêm điểm cho player (chỉ owner gọi được — game server)
     * @param  _player  Địa chỉ ví của người chơi
     * @param  _points  Số điểm cộng thêm (thường = 10)
     */
    function addScore(address _player, uint256 _points) external onlyOwner {
        require(_player != address(0), "Invalid address");
        require(_points > 0, "Points must be > 0");

        if (!players[_player].exists) {
            playerList.push(_player);
            players[_player].exists = true;
        }

        players[_player].score += _points;
        players[_player].wins  += 1;

        emit ScoreAdded(
            _player,
            _points,
            players[_player].score,
            players[_player].wins
        );
    }

    /**
     * @notice Reset điểm về 0 (chỉ owner)
     */
    function resetScore(address _player) external onlyOwner {
        players[_player].score = 0;
        players[_player].wins  = 0;
        emit ScoreReset(_player);
    }

    // ── Read functions (public) ───────────────────────────────

    /**
     * @notice Đọc thông tin 1 player
     */
    function getProfile(address _player) external view returns (
        string memory username,
        uint256 score,
        uint32  wins,
        bool    exists
    ) {
        Player storage p = players[_player];
        return (p.username, p.score, p.wins, p.exists);
    }

    /**
     * @notice Trả về top N player theo điểm (sắp xếp off-chain bởi frontend)
     * @param  limit  Số lượng tối đa trả về (tối đa 50)
     */
    function getLeaderboard(uint256 limit) external view returns (
        address[] memory addrs,
        string[]  memory usernames,
        uint256[] memory scores,
        uint32[]  memory wins
    ) {
        uint256 total = playerList.length;
        if (limit > total) limit = total;
        if (limit > 50)   limit = 50;

        addrs     = new address[](total);
        usernames = new string[](total);
        scores    = new uint256[](total);
        wins      = new uint32[](total);

        for (uint256 i = 0; i < total; i++) {
            address a      = playerList[i];
            addrs[i]     = a;
            usernames[i] = players[a].username;
            scores[i]    = players[a].score;
            wins[i]      = players[a].wins;
        }

        // Sắp xếp bubble sort (đủ dùng với leaderboard nhỏ ≤ 50)
        for (uint256 i = 0; i < total; i++) {
            for (uint256 j = i + 1; j < total; j++) {
                if (scores[j] > scores[i]) {
                    (addrs[i],     addrs[j])     = (addrs[j],     addrs[i]);
                    (usernames[i], usernames[j]) = (usernames[j], usernames[i]);
                    (scores[i],    scores[j])    = (scores[j],    scores[i]);
                    (wins[i],      wins[j])      = (wins[j],      wins[i]);
                }
            }
        }

        // Cắt theo limit
        assembly { mstore(addrs, limit) mstore(usernames, limit) mstore(scores, limit) mstore(wins, limit) }
    }

    /**
     * @notice Tổng số player đã đăng ký
     */
    function totalPlayers() external view returns (uint256) {
        return playerList.length;
    }

    // ── Admin ─────────────────────────────────────────────────

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
