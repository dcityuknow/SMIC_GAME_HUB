// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ScoreBoard
 * @notice SMIC GAME HUB — Seismic Testnet
 * User tự gọi addScore() cho chính mình sau khi thắng game.
 */
contract ScoreBoard {

    struct Player {
        string  username;
        uint256 score;
        uint32  wins;
        bool    exists;
    }

    address public owner;
    mapping(address => Player) private players;
    address[] private playerList;

    event UsernameSet(address indexed player, string username);
    event ScoreAdded(address indexed player, uint256 points, uint256 totalScore, uint32 wins);

    constructor() {
        owner = msg.sender;
    }

    // ── Bất kỳ ai cũng gọi được, nhưng chỉ cộng điểm cho chính msg.sender ──

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

    /**
     * @notice User tự gọi sau khi thắng — cộng điểm cho chính mình (msg.sender)
     * @param  _points  Số điểm (game truyền vào, thường = 10)
     */
    function addScore(uint256 _points) external {
        require(_points > 0 && _points <= 100, "Invalid points");
        if (!players[msg.sender].exists) {
            playerList.push(msg.sender);
            players[msg.sender].exists = true;
        }
        players[msg.sender].score += _points;
        players[msg.sender].wins  += 1;
        emit ScoreAdded(msg.sender, _points, players[msg.sender].score, players[msg.sender].wins);
    }

    // ── Read ──────────────────────────────────────────────────

    function getProfile(address _player) external view returns (
        string memory username, uint256 score, uint32 wins, bool exists
    ) {
        Player storage p = players[_player];
        return (p.username, p.score, p.wins, p.exists);
    }

    function getLeaderboard(uint256 limit) external view returns (
        address[] memory addrs,
        string[]  memory usernames,
        uint256[] memory scores,
        uint32[]  memory winsArr
    ) {
        uint256 total = playerList.length;
        if (limit > total) limit = total;
        if (limit > 50)    limit = 50;

        addrs     = new address[](total);
        usernames = new string[](total);
        scores    = new uint256[](total);
        winsArr   = new uint32[](total);

        for (uint256 i = 0; i < total; i++) {
            address a    = playerList[i];
            addrs[i]     = a;
            usernames[i] = players[a].username;
            scores[i]    = players[a].score;
            winsArr[i]   = players[a].wins;
        }

        // Bubble sort theo score giảm dần
        for (uint256 i = 0; i < total; i++) {
            for (uint256 j = i + 1; j < total; j++) {
                if (scores[j] > scores[i]) {
                    (addrs[i],     addrs[j])     = (addrs[j],     addrs[i]);
                    (usernames[i], usernames[j]) = (usernames[j], usernames[i]);
                    (scores[i],    scores[j])    = (scores[j],    scores[i]);
                    (winsArr[i],   winsArr[j])   = (winsArr[j],   winsArr[i]);
                }
            }
        }

        assembly {
            mstore(addrs,     limit)
            mstore(usernames, limit)
            mstore(scores,    limit)
            mstore(winsArr,   limit)
        }
    }

    function totalPlayers() external view returns (uint256) {
        return playerList.length;
    }
}
