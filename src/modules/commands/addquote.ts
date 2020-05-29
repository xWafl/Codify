import { CommandBuilder } from "@enitoni/gears-discordjs";

import { ParseArgumentsState } from "../../common/parsing/middleware/parseArguments";
import { matchPrefixesStrict } from "../../common/matching/matchPrefixesStrict";

import { resolveArrayToOne } from "../constants";

import knex from "../../../db/knex";

const checkBalance = async (id: string) => {
    const balance = (await knex("user").where({ userid: id }))[0].balance;

    return parseInt(balance) >= 10000;
};

const addQuote = async (quote: string) => {
    await knex("quotes").insert({ quote });
};
const updateBalance = async (id: string, addExtract: number) => {
    const balance = (await knex("user").where({ userid: id }))[0].balance;

    await knex("user")
        .where({ userid: id })
        .update({
            balance: parseInt(balance) + addExtract
        });
};

export default new CommandBuilder()
    .match(matchPrefixesStrict("addquote"))
    .use<ParseArgumentsState>(async (context: any) => {
        const { message } = context;
        const { args } = context.state;
        try {
            if (!args.length) {
                return message.channel.send(
                    `**Error**: You cannot put an empty quote.`
                );
            }
            if (args.join(" ").length > 500) {
                return message.channel.send("**Error**: Quote too long.");
            }
            if (!(await checkBalance(message.author.id))) {
                return message.channel.send(`**Error**: Not enough money.`);
            }
            await updateBalance(message.author.id, -10000);

            message.channel.send(
                `**Thanks for your submission, you will have to wait for the admnistrator to approve your quote. If he doesnt do it in 24h you will get your money back, if he rejects your quote you will only get half of your money back.**\n**Your quote is:**\n${args.join(
                    " "
                )}`
            );
            message.client.users
                .get("270972671490129921")
                ?.send(
                    `*${message.author.username} wants to add a new quote.*`
                );
            message.client.users
                .get("270972671490129921")
                ?.send(
                    `---------------------------------------------------------------------------`
                );
            const messageSent = await message.client.users
                .get("270972671490129921")
                ?.send(
                    `${args.join(
                        " "
                    )}\n---------------------------------------------------------------------------`
                );
            console.log(`New quote request from: ${message.author.username}`);
            await resolveArrayToOne(messageSent).react("👍");
            await resolveArrayToOne(messageSent).react("👎");
            setTimeout(async () => {
                const filter = (reaction: any) =>
                    reaction.emoji.name === "👍" ||
                    reaction.emoji.name === "👎";

                let collector = await messageSent.createReactionCollector(
                    filter,
                    {
                        max: 1,
                        time: 3600000 * 24
                    }
                );
                collector.on(
                    "collect",
                    async (reaction: any, collected: any) => {
                        if (reaction.emoji.name === "👍") {
                            // we add the quote to the database
                            await addQuote(args.join(" "));
                            message.client.users
                                .get("270972671490129921")
                                ?.send(
                                    "Successfully added the new quote. :white_check_mark:"
                                );
                            message.author.send(
                                `Your quote was approved by the administrator. :white_check_mark: \n**Your quote:**\n${args.join(
                                    " "
                                )}`
                            );
                        }
                        if (reaction.emoji.name === "👎") {
                            // we dont add the quote and we return half the money
                            await updateBalance(message.author.id, 5000);

                            message.client.users
                                .get("270972671490129921")
                                ?.send(
                                    "The quote has been successfully rejected. :x:"
                                );
                            message.author.send(
                                `Your quote was rejected by the administrator. :x:\n**Your quote:**\n${args.join(
                                    " "
                                )}`
                            );
                        }
                    }
                );
                collector.on("end", async (collected: any) => {
                    if (collected.size === 0) {
                        // we return the money and send a dm to the guy
                        await updateBalance(message.author.id, 10000);
                        message.client.users
                            .get("270972671490129921")
                            ?.send(
                                `Failed to react to the quote in time. :x: \n**The quote:**\n${args.join(
                                    " "
                                )}`
                            );
                        message.author.send(
                            `Sorry but the administrator didn't see your quote in time. :x:\n**Your quote:**\n${args.join(
                                " "
                            )}`
                        );
                    }
                });
                message.delete();
            }, 1000);
        } catch (e) {
            return message.channel.send("**Error**: Something went wrong.");
        }
    })
    .done();
